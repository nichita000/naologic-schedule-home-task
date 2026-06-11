import { WorkCenterDocument, WorkOrderDocument } from '../models/work-order.model';

/**
 * Seed data for the Work Order Schedule.
 *
 * Demonstrates the spec requirements:
 * - 5 work centers with realistic manufacturing names
 * - 18 work orders across them, covering all 4 statuses
 * - Several centers carry multiple, non-overlapping orders (wc-1, wc-3, wc-4)
 * - Short orders that compact into status markers at wider timescales
 * - Multi-month spans so every bar is legible even at Month zoom, all within the
 *   visible range (timeline starts one month before "today" = 2026-06-09)
 */

export const WORK_CENTERS: WorkCenterDocument[] = [
  { docId: 'wc-1', docType: 'workCenter', data: { name: 'Extrusion Line A' } },
  { docId: 'wc-2', docType: 'workCenter', data: { name: 'CNC Machine 1' } },
  { docId: 'wc-3', docType: 'workCenter', data: { name: 'Assembly Station' } },
  { docId: 'wc-4', docType: 'workCenter', data: { name: 'Quality Control' } },
  { docId: 'wc-5', docType: 'workCenter', data: { name: 'Packaging Line' } },
];

export const WORK_ORDERS: WorkOrderDocument[] = [
  // Extrusion Line A — three sequential, non-overlapping orders
  {
    docId: 'wo-1',
    docType: 'workOrder',
    data: { name: 'Casing Extrusion', workCenterId: 'wc-1', status: 'complete', startDate: '2026-05-01', endDate: '2026-06-18' },
  },
  {
    docId: 'wo-2',
    docType: 'workOrder',
    data: { name: 'Frame Profile Run', workCenterId: 'wc-1', status: 'in-progress', startDate: '2026-06-28', endDate: '2026-09-12' },
  },
  {
    docId: 'wo-3',
    docType: 'workOrder',
    data: { name: 'Trim Batch #4', workCenterId: 'wc-1', status: 'open', startDate: '2026-09-20', endDate: '2026-11-21' },
  },

  // CNC Machine 1 — single blocked order spanning "today"
  {
    docId: 'wo-4',
    docType: 'workOrder',
    data: { name: 'Spindle Bracket', workCenterId: 'wc-2', status: 'blocked', startDate: '2026-06-15', endDate: '2026-09-05' },
  },
  {
    docId: 'wo-10',
    docType: 'workOrder',
    data: { name: 'Fixture Swap', workCenterId: 'wc-2', status: 'open', startDate: '2026-09-22', endDate: '2026-09-27' },
  },
  {
    docId: 'wo-11',
    docType: 'workOrder',
    data: { name: 'Month-End Cleanup', workCenterId: 'wc-2', status: 'in-progress', startDate: '2026-09-29', endDate: '2026-10-02' },
  },
  {
    docId: 'wo-12',
    docType: 'workOrder',
    data: { name: 'Laser Alignment', workCenterId: 'wc-2', status: 'blocked', startDate: '2026-10-06', endDate: '2026-10-06' },
  },

  // Assembly Station — two non-overlapping orders
  {
    docId: 'wo-5',
    docType: 'workOrder',
    data: { name: 'Gearbox Assembly', workCenterId: 'wc-3', status: 'in-progress', startDate: '2026-05-04', endDate: '2026-07-04' },
  },
  {
    docId: 'wo-6',
    docType: 'workOrder',
    data: { name: 'Motor Mount Build', workCenterId: 'wc-3', status: 'open', startDate: '2026-07-20', endDate: '2026-10-10' },
  },

  // Quality Control — two non-overlapping orders
  {
    docId: 'wo-7',
    docType: 'workOrder',
    data: { name: 'Inbound Inspection', workCenterId: 'wc-4', status: 'complete', startDate: '2026-05-02', endDate: '2026-06-27' },
  },
  {
    docId: 'wo-8',
    docType: 'workOrder',
    data: { name: 'Final Audit', workCenterId: 'wc-4', status: 'blocked', startDate: '2026-07-06', endDate: '2026-09-26' },
  },
  {
    docId: 'wo-13',
    docType: 'workOrder',
    data: { name: 'Spot Check #1', workCenterId: 'wc-4', status: 'complete', startDate: '2026-10-08', endDate: '2026-10-09' },
  },
  {
    docId: 'wo-14',
    docType: 'workOrder',
    data: { name: 'Spot Check #2', workCenterId: 'wc-4', status: 'open', startDate: '2026-10-10', endDate: '2026-10-11' },
  },
  {
    docId: 'wo-15',
    docType: 'workOrder',
    data: { name: 'Spot Check #3', workCenterId: 'wc-4', status: 'in-progress', startDate: '2026-10-12', endDate: '2026-10-12' },
  },
  {
    docId: 'wo-16',
    docType: 'workOrder',
    data: { name: 'Spot Check #4', workCenterId: 'wc-4', status: 'blocked', startDate: '2026-10-13', endDate: '2026-10-13' },
  },
  {
    docId: 'wo-17',
    docType: 'workOrder',
    data: { name: 'Spot Check #5', workCenterId: 'wc-4', status: 'complete', startDate: '2026-10-14', endDate: '2026-10-14' },
  },
  {
    docId: 'wo-18',
    docType: 'workOrder',
    data: { name: 'Spot Check #6', workCenterId: 'wc-4', status: 'open', startDate: '2026-10-15', endDate: '2026-10-15' },
  },

  // Packaging Line — single open order
  {
    docId: 'wo-9',
    docType: 'workOrder',
    data: { name: 'Pallet Wrapping', workCenterId: 'wc-5', status: 'open', startDate: '2026-06-01', endDate: '2026-08-15' },
  },
];
