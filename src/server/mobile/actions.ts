import "server-only";
import type { ActionResult } from "@/lib/action-result";
import * as bd from "../actions/bd";
import * as finance from "../actions/finance";
import * as invoices from "../actions/invoices";
import * as payroll from "../actions/payroll";
import * as settings from "../actions/settings";
import * as shell from "../actions/shell";
import * as tasks from "../actions/tasks";
import * as team from "../actions/team";
import * as todo from "../actions/todo";
import * as vehicles from "../actions/vehicles";
import * as wip from "../actions/wip";

type AnyAction = (input: never) => Promise<ActionResult<unknown>>;

/**
 * Everything the mobile app can change, by stable name. Each entry is the web's own server action, so
 * validation, permission checks, audit entries, notifications and side effects are identical on both.
 * Not listed: sign-in and password (their own endpoints) and the web-only Company/Partner view cookie.
 */
export const MOBILE_ACTIONS = {
  "wip.create": wip.createLeadAction,
  "wip.update": wip.updateLeadAction,
  "wip.setRemark": wip.setRemarkAction,
  "wip.delete": wip.deleteLeadAction,

  "tasks.create": tasks.createTaskAction,
  "tasks.update": tasks.updateTaskAction,
  "tasks.setStatus": tasks.setTaskStatusAction,
  "tasks.setReminders": tasks.setTaskRemindersAction,
  "tasks.comment": tasks.addTaskCommentAction,
  "tasks.delete": tasks.deleteTaskAction,
  "followUps.create": tasks.createFollowUpAction,
  "followUps.update": tasks.updateFollowUpAction,
  "followUps.reschedule": tasks.rescheduleFollowUpAction,
  "followUps.complete": tasks.completeFollowUpAction,
  "followUps.delete": tasks.deleteFollowUpAction,

  "todos.create": todo.createTodoAction,
  "todos.update": todo.updateTodoAction,
  "todos.delete": todo.deleteTodoAction,
  "achievements.markSeen": todo.markAchievementsSeenAction,

  "bd.create": bd.createBdMeetingAction,
  "bd.update": bd.updateBdMeetingAction,
  "bd.setTemperature": bd.setBdTemperatureAction,
  "bd.setComment": bd.setBdCommentAction,
  "bd.delete": bd.deleteBdMeetingAction,

  "cabs.book": vehicles.bookCabAction,
  "cabs.setStatus": vehicles.setCabStatusAction,

  "finance.addEntry": finance.addLedgerEntryAction,
  "finance.voidEntry": finance.voidLedgerEntryAction,

  "invoices.raise": invoices.raiseInvoiceAction,
  "invoices.createProforma": invoices.createProformaAction,
  "invoices.convertProforma": invoices.convertProformaAction,
  "invoices.recordPayment": invoices.recordPaymentAction,
  "invoices.reversePayment": invoices.reversePaymentAction,
  "invoices.issueCreditNote": invoices.issueCreditNoteAction,
  "invoices.email": invoices.emailDocumentAction,

  "payroll.start": payroll.startPayrollRunAction,
  "payroll.updatePayslip": payroll.updatePayslipAction,
  "payroll.recalculate": payroll.recalculateRunAction,
  "payroll.approve": payroll.approvePayrollAction,
  "payroll.disburse": payroll.disbursePayrollAction,

  "settings.setPermission": settings.setPermissionAction,
  "settings.saveTargets": settings.saveTargetsAction,

  "team.invite": team.inviteMemberAction,
  "team.update": team.updateMemberAction,
  "team.resendInvite": team.resendInviteAction,

  "notifications.markRead": shell.markNotificationsReadAction,
} satisfies Record<string, AnyAction>;

export type MobileActionName = keyof typeof MOBILE_ACTIONS;

export function mobileAction(name: string): AnyAction | null {
  return Object.hasOwn(MOBILE_ACTIONS, name) ? (MOBILE_ACTIONS[name as MobileActionName] as AnyAction) : null;
}
