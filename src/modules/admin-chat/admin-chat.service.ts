import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ADMIN_CHAT_CHANNELS, AdminChatChannel } from './admin-chat.constants';

@Injectable()
export class AdminChatService {
  constructor(private readonly prismaService: PrismaService) {}

  async listMessages(channel: string, viewerId: string) {
    const normalizedChannel = this.normalizeChannel(channel);
    const messages = await this.prismaService.adminMessage.findMany({
      where: {
        channel: normalizedChannel,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            accountNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    const unreadMessages = messages.filter((message) => !message.readBy.includes(viewerId));

    await Promise.all(
      unreadMessages.map((message) =>
        this.prismaService.adminMessage.update({
          where: { id: message.id },
          data: {
            readBy: {
              push: viewerId,
            },
          },
        }),
      ),
    );

    return messages
      .map((message) => ({
        ...message,
        readBy: message.readBy.includes(viewerId)
          ? message.readBy
          : [...message.readBy, viewerId],
      }))
      .reverse()
      .map((message) => this.serializeMessage(message));
  }

  async postMessage(
    channel: string,
    authorId: string | null,
    content: string,
    isSystem = false,
  ) {
    const normalizedChannel = this.normalizeChannel(channel);
    const trimmedContent = content.trim();

    if (!trimmedContent) {
      throw new BadRequestException('Message content is required');
    }

    const message = await this.prismaService.adminMessage.create({
      data: {
        authorId,
        content: trimmedContent,
        channel: normalizedChannel,
        isSystem,
        readBy: authorId ? [authorId] : [],
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            accountNumber: true,
          },
        },
      },
    });

    return this.serializeMessage(message);
  }

  async postSystemAlert(channel: string, content: string) {
    return this.postMessage(channel, null, content, true);
  }

  async listUnreadCounts(viewerId: string) {
    const counts = await Promise.all(
      ADMIN_CHAT_CHANNELS.map(async (channel) => ({
        channel,
        count: await this.prismaService.adminMessage.count({
          where: {
            channel,
            NOT: {
              readBy: {
                has: viewerId,
              },
            },
          },
        }),
      })),
    );

    return counts.reduce<Record<AdminChatChannel, number>>(
      (accumulator, item) => ({
        ...accumulator,
        [item.channel]: item.count,
      }),
      {
        general: 0,
        compliance: 0,
        risk: 0,
      },
    );
  }

  async listOnlineAdmins(userIds: string[]) {
    if (userIds.length === 0) {
      return [];
    }

    const admins = await this.prismaService.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        email: true,
        accountNumber: true,
      },
      orderBy: {
        email: 'asc',
      },
    });

    return admins.map((admin) => ({
      ...admin,
      displayName: admin.email.split('@')[0],
    }));
  }

  private normalizeChannel(channel: string): AdminChatChannel {
    const normalized = channel.trim().toLowerCase();

    if (!ADMIN_CHAT_CHANNELS.includes(normalized as AdminChatChannel)) {
      throw new BadRequestException(`Unsupported admin chat channel: ${channel}`);
    }

    return normalized as AdminChatChannel;
  }

  private serializeMessage(message: {
    id: string;
    authorId: string | null;
    content: string;
    channel: string;
    isSystem: boolean;
    createdAt: Date;
    readBy: string[];
    author?: {
      id: string;
      email: string;
      accountNumber: string;
    } | null;
  }) {
    return {
      id: message.id,
      authorId: message.authorId,
      content: message.content,
      channel: message.channel,
      isSystem: message.isSystem,
      createdAt: message.createdAt,
      readBy: message.readBy,
      author: message.author
        ? {
            id: message.author.id,
            email: message.author.email,
            accountNumber: message.author.accountNumber,
            displayName: message.author.email.split('@')[0],
          }
        : null,
    };
  }
}
