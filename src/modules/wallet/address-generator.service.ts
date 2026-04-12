import {
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Network } from '@prisma/client';
import { BIP32Factory } from 'bip32';
import * as bip39 from 'bip39';
import { HDNodeWallet, keccak256 } from 'ethers';
import * as ecc from 'tiny-secp256k1';
import { PrismaService } from '../../common/prisma/prisma.service';
import { accountSelect } from '../../common/prisma/selects';
import { AccountsService } from '../accounts/accounts.service';

const bs58checkModule = require('bs58check');
const bs58check = (bs58checkModule.default ?? bs58checkModule) as {
  encode(payload: Uint8Array | number[]): string;
};

const bip32 = BIP32Factory(ecc);

@Injectable()
export class AddressGeneratorService implements OnModuleInit {
  private masterMnemonic = '';
  private trxRoot: ReturnType<typeof bip32.fromSeed> | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly accountsService: AccountsService,
  ) {}

  onModuleInit(): void {
    const mnemonic = this.configService.get<string>('wallet.masterMnemonic') ?? '';

    if (!mnemonic || !bip39.validateMnemonic(mnemonic)) {
      throw new InternalServerErrorException(
        'WALLET_MASTER_MNEMONIC must be configured with a valid BIP39 mnemonic',
      );
    }

    const seedBuffer = bip39.mnemonicToSeedSync(mnemonic);
    this.masterMnemonic = mnemonic;
    this.trxRoot = bip32.fromSeed(seedBuffer);
  }

  generateERC20Address(index: number): { address: string; privateKey: string } {
    const wallet = HDNodeWallet.fromPhrase(
      this.masterMnemonic,
      undefined,
      `m/44'/60'/0'/0/${index}`,
    );

    return {
      address: wallet.address,
      privateKey: wallet.privateKey.replace(/^0x/, ''),
    };
  }

  generateTRC20Address(index: number): { address: string; privateKey: string } {
    if (!this.trxRoot) {
      throw new InternalServerErrorException('TRON wallet root was not initialized');
    }

    const node = this.trxRoot.derivePath(`m/44'/195'/0'/0/${index}`);

    if (!node.privateKey) {
      throw new InternalServerErrorException('Unable to derive TRON private key');
    }

    const uncompressedPublicKey = ecc.pointFromScalar(node.privateKey, false);

    if (!uncompressedPublicKey) {
      throw new InternalServerErrorException('Unable to derive TRON public key');
    }

    const addressHash = Buffer.from(
      keccak256(Buffer.from(uncompressedPublicKey.slice(1))).slice(2),
      'hex',
    );
    const payload = Buffer.concat([
      Buffer.from([0x41]),
      addressHash.subarray(addressHash.length - 20),
    ]);

    return {
      address: bs58check.encode(payload),
      privateKey: Buffer.from(node.privateKey).toString('hex'),
    };
  }

  async getOrCreateAddress(userId: string, accountId: string, network: Network) {
    const existing = await this.prismaService.depositAddress.findUnique({
      where: {
        userId_network: {
          userId,
          network,
        },
      },
    });

    if (existing) {
      if (existing.accountId !== accountId) {
        return this.prismaService.depositAddress.update({
          where: { id: existing.id },
          data: { accountId },
        });
      }

      return existing;
    }

    const [{ _max }, fallbackAccount] = await Promise.all([
      this.prismaService.depositAddress.aggregate({
        _max: {
          derivationIndex: true,
        },
      }),
      this.prismaService.account.findFirst({
        where: {
          userId,
          id: { not: accountId },
        },
        select: accountSelect,
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      }),
    ]);

    const derivationIndex = (_max.derivationIndex ?? 0) + 1;
    const generator =
      network === Network.TRC20
        ? this.generateTRC20Address(derivationIndex)
        : this.generateERC20Address(derivationIndex);

    return this.prismaService.depositAddress.create({
      data: {
        userId,
        accountId: accountId || fallbackAccount?.id || accountId,
        network,
        address: generator.address,
        derivationIndex,
      },
    });
  }

  async getOrCreateAddresses(userId: string, accountId?: string) {
    const resolvedAccount =
      accountId != null
        ? await this.accountsService.resolveAccountForUser(userId, accountId)
        : await this.accountsService.getDefaultAccountOrThrow(userId);

    const [trc20, erc20] = await Promise.all([
      this.getOrCreateAddress(userId, resolvedAccount.id, Network.TRC20),
      this.getOrCreateAddress(userId, resolvedAccount.id, Network.ERC20),
    ]);

    return [trc20, erc20];
  }
}
