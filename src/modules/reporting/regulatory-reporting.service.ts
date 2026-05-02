import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

export interface QuarterlyReport {
  period: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  deposits: {
    count: number;
    totalAmount: number;
  };
  withdrawals: {
    count: number;
    totalAmount: number;
  };
  trading: {
    closedPositions: number;
    volumeTraded: number;
    netPnl: number;
    liquidations: number;
  };
  complaints: {
    total: number;
    resolved: number;
    resolutionRatePercent: number;
  };
  usersByCountry: Array<{ country: string; count: number }>;
  generatedAt: string;
}

@Injectable()
export class RegulatoryReportingService {
  private readonly logger = new Logger(RegulatoryReportingService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async generateQuarterlyReport(
    year: number,
    quarter: 1 | 2 | 3 | 4,
  ): Promise<QuarterlyReport> {
    const startMonth = (quarter - 1) * 3;
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, startMonth + 3, 1);

    const [deposits, withdrawals, positions, complaints, usersByCountry] =
      await Promise.all([
        this.prismaService.transaction.findMany({
          where: {
            type: 'DEPOSIT',
            status: 'COMPLETED',
            createdAt: { gte: startDate, lt: endDate },
          },
          select: { amount: true },
        }),

        this.prismaService.transaction.findMany({
          where: {
            type: 'WITHDRAW',
            status: 'COMPLETED',
            createdAt: { gte: startDate, lt: endDate },
          },
          select: { amount: true },
        }),

        this.prismaService.position.findMany({
          where: {
            status: 'CLOSED',
            closedAt: { gte: startDate, lt: endDate },
          },
          select: { pnl: true, marginUsed: true, leverage: true },
        }),

        this.prismaService.complaint.findMany({
          where: { createdAt: { gte: startDate, lt: endDate } },
          select: { resolvedAt: true },
        }),

        this.prismaService.kycSubmission.groupBy({
          by: ['country'],
          _count: { id: true },
          where: { createdAt: { lt: endDate } },
          orderBy: { _count: { id: 'desc' } },
          take: 30,
        }),
      ]);

    const totalDeposits = deposits.reduce((s, d) => s + Number(d.amount), 0);
    const totalWithdrawals = withdrawals.reduce((s, w) => s + Number(w.amount), 0);

    const netPnl = positions.reduce((s, p) => s + Number(p.pnl ?? 0), 0);
    const volumeTraded = positions.reduce(
      (s, p) => s + Number(p.marginUsed) * (p.leverage || 1),
      0,
    );

    const resolvedComplaints = complaints.filter((c) => c.resolvedAt !== null).length;
    const resolutionRate =
      complaints.length > 0 ? (resolvedComplaints / complaints.length) * 100 : 100;

    return {
      period: `Q${quarter} ${year}`,
      year,
      quarter,
      deposits: {
        count: deposits.length,
        totalAmount: Number(totalDeposits.toFixed(2)),
      },
      withdrawals: {
        count: withdrawals.length,
        totalAmount: Number(totalWithdrawals.toFixed(2)),
      },
      trading: {
        closedPositions: positions.length,
        volumeTraded: Number(volumeTraded.toFixed(2)),
        netPnl: Number(netPnl.toFixed(2)),
        liquidations: 0, // TODO: add close reason tracking when needed
      },
      complaints: {
        total: complaints.length,
        resolved: resolvedComplaints,
        resolutionRatePercent: Number(resolutionRate.toFixed(1)),
      },
      usersByCountry: usersByCountry.map((row) => ({
        country: row.country,
        count: row._count.id,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  exportAsCsv(report: QuarterlyReport): string {
    const rows: [string, string | number][] = [
      ['Period', report.period],
      ['Generated At', report.generatedAt],
      ['', ''],
      ['--- Fund Flows ---', ''],
      ['Deposit Count', report.deposits.count],
      ['Total Deposits (USDT)', report.deposits.totalAmount],
      ['Withdrawal Count', report.withdrawals.count],
      ['Total Withdrawals (USDT)', report.withdrawals.totalAmount],
      ['', ''],
      ['--- Trading Activity ---', ''],
      ['Closed Positions', report.trading.closedPositions],
      ['Volume Traded (USDT)', report.trading.volumeTraded],
      ['Net P&L (USDT)', report.trading.netPnl],
      ['Liquidations', report.trading.liquidations],
      ['', ''],
      ['--- Complaints ---', ''],
      ['Total Complaints', report.complaints.total],
      ['Resolved', report.complaints.resolved],
      ['Resolution Rate (%)', report.complaints.resolutionRatePercent],
      ['', ''],
      ['--- Users by Country ---', ''],
      ['Country', 'Count'],
    ];

    for (const entry of report.usersByCountry) {
      rows.push([entry.country, entry.count]);
    }

    return rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }
}
