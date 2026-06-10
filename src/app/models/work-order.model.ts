/**
 * Document models for the Work Order Schedule.
 *
 * Every document follows the ERP envelope `{ docId, docType, data }` described in
 * the technical spec, so this shape mirrors what a real Naologic API would return.
 */

/** Work order lifecycle status. Values match `BadgeStatus` so badges can reuse them. */
export type WorkOrderStatus = 'open' | 'in-progress' | 'complete' | 'blocked';

export interface WorkCenterDocument {
  docId: string;
  docType: 'workCenter';
  data: {
    name: string;
  };
}

export interface WorkOrderDocument {
  docId: string;
  docType: 'workOrder';
  data: {
    name: string;
    /** References `WorkCenterDocument.docId`. */
    workCenterId: string;
    status: WorkOrderStatus;
    /** ISO date, e.g. "2026-06-15". */
    startDate: string;
    /** ISO date (inclusive). */
    endDate: string;
  };
}
