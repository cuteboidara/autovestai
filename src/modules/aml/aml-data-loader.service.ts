import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as csvParser from 'csv-parser';

import { PrismaService } from '../../common/prisma/prisma.service';

// Baseline high-risk / sanctioned countries — seeded on every startup
const BASELINE_HIGH_RISK_COUNTRIES = [
  { countryCode: 'KP', countryName: 'North Korea', riskLevel: 'high', reason: 'OFAC SDN program — comprehensive sanctions' },
  { countryCode: 'IR', countryName: 'Iran', riskLevel: 'high', reason: 'OFAC SDN program — comprehensive sanctions' },
  { countryCode: 'SY', countryName: 'Syria', riskLevel: 'high', reason: 'OFAC SDN program — comprehensive sanctions' },
  { countryCode: 'CU', countryName: 'Cuba', riskLevel: 'high', reason: 'OFAC SDN program — comprehensive sanctions' },
  { countryCode: 'SD', countryName: 'Sudan', riskLevel: 'high', reason: 'OFAC SDN program — comprehensive sanctions' },
  { countryCode: 'MM', countryName: 'Myanmar', riskLevel: 'high', reason: 'US/EU sanctions program' },
  { countryCode: 'RU', countryName: 'Russia', riskLevel: 'medium', reason: 'OFAC/EU sectoral sanctions' },
  { countryCode: 'BY', countryName: 'Belarus', riskLevel: 'medium', reason: 'EU/US sanctions program' },
  { countryCode: 'AF', countryName: 'Afghanistan', riskLevel: 'high', reason: 'OFAC SDN — Taliban designation' },
  { countryCode: 'YE', countryName: 'Yemen', riskLevel: 'high', reason: 'OFAC SDN program' },
  { countryCode: 'LY', countryName: 'Libya', riskLevel: 'high', reason: 'OFAC SDN program' },
  { countryCode: 'SO', countryName: 'Somalia', riskLevel: 'high', reason: 'OFAC SDN program' },
  { countryCode: 'VE', countryName: 'Venezuela', riskLevel: 'medium', reason: 'OFAC sectoral sanctions' },
  { countryCode: 'ZW', countryName: 'Zimbabwe', riskLevel: 'medium', reason: 'OFAC SDN program' },
];

@Injectable()
export class AmlDataLoaderService {
  private readonly logger = new Logger(AmlDataLoaderService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async seedHighRiskCountries(): Promise<void> {
    for (const country of BASELINE_HIGH_RISK_COUNTRIES) {
      await this.prismaService.highRiskCountry.upsert({
        where: { countryCode: country.countryCode },
        create: country,
        update: { riskLevel: country.riskLevel, reason: country.reason },
      });
    }
    this.logger.log(`Seeded ${BASELINE_HIGH_RISK_COUNTRIES.length} high-risk country records`);
  }

  /**
   * Loads the OFAC SDN enhanced CSV file into the database.
   * Download from: https://ofac.treasury.gov/system/files/126/sdn_enhanced.csv
   * Place at: src/data/ofac-sdn.csv
   *
   * Expected CSV columns: ent_num, SDN_Name, SDN_Type, Program, Title, ...
   */
  async loadOfacCsv(): Promise<number> {
    const filePath = path.join(process.cwd(), 'src', 'data', 'ofac-sdn.csv');

    if (!fs.existsSync(filePath)) {
      this.logger.warn('OFAC SDN CSV not found — skipping DB load. Download from https://ofac.treasury.gov/');
      return 0;
    }

    const records: {
      entityId: string;
      name: string;
      sdnType: string;
      program: string | null;
      nameFragments: string[];
    }[] = [];

    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row: Record<string, string>) => {
          const entityId = (row['ent_num'] ?? row['entityID'] ?? '').trim();
          const name = (row['SDN_Name'] ?? row['name'] ?? '').trim();
          const sdnType = (row['SDN_Type'] ?? row['SDNType'] ?? '').trim();
          const program = (row['Program'] ?? row['program'] ?? '').trim() || null;

          if (entityId && name) {
            records.push({
              entityId,
              name,
              sdnType,
              program,
              nameFragments: this.extractNameFragments(name),
            });
          }
        })
        .on('end', () => resolve())
        .on('error', reject);
    });

    if (records.length === 0) {
      this.logger.warn('OFAC CSV parsed but contained no valid records');
      return 0;
    }

    // Clear and reload in batches
    await this.prismaService.ofacSdn.deleteMany();
    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      await this.prismaService.ofacSdn.createMany({
        data: records.slice(i, i + batchSize),
        skipDuplicates: true,
      });
    }

    this.logger.log(`Loaded ${records.length} OFAC SDN records from CSV`);
    return records.length;
  }

  extractNameFragments(name: string): string[] {
    return name
      .toUpperCase()
      .split(/[\s,;]+/)
      .map((part) => part.replace(/[^A-Z]/g, ''))
      .filter((part) => part.length > 2);
  }
}
