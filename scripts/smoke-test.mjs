import { dashboardModule } from "../modules/dashboard.js";
import { membersModule } from "../modules/members.js";
import { membershipsModule } from "../modules/memberships.js";
import { paymentsModule } from "../modules/payments.js";
import { renewalsModule } from "../modules/renewals.js";
import { remindersModule } from "../modules/reminders.js";
import { trainersModule } from "../modules/trainers.js";
import { attendanceModule } from "../modules/attendance.js";
import { workoutsModule } from "../modules/workouts.js";
import { progressModule } from "../modules/progress.js";
import { reportsModule } from "../modules/reports.js";
import { settingsModule } from "../modules/settings.js";
import { myMembershipModule } from "../modules/my-membership.js";
import { myPaymentsModule } from "../modules/my-payments.js";
import { trainerCheckinModule } from "../modules/trainer-checkin.js";

function makeData() {
  return {
    members: [],
    trainers: [],
    membership_plans: [],
    payments: [],
    attendance: [],
    trainer_attendance: [],
    workout_templates: [],
    workout_assignments: [],
    progress_records: [],
    reminders: []
  };
}

const ownerContext = {
  profile: { name: "Owner", role: "owner", uid: "owner-uid" },
  settings: { gymName: "Smoke Gym", currency: "INR", gymCode: "SMOK-1234" },
  services: { mode: "local" },
  data: makeData(),
  myMember: null,
  myMemberId: null
};

// A member with no roster doc (membership-being-set-up path) and with one.
const memberContext = {
  profile: { name: "Member", role: "member", uid: "member-uid" },
  settings: { gymName: "Smoke Gym", currency: "INR" },
  services: { mode: "local" },
  data: makeData(),
  myMember: { id: "m1", uid: "member-uid", fullName: "Member", status: "Active", endDate: "2099-01-01" },
  myMemberId: "m1"
};
memberContext.data.members = [memberContext.myMember];

const ownerModules = [
  dashboardModule, membersModule, membershipsModule, paymentsModule, renewalsModule,
  remindersModule, trainersModule, attendanceModule, workoutsModule, progressModule,
  reportsModule, settingsModule
];

const memberModules = [
  dashboardModule, attendanceModule, progressModule, myMembershipModule, myPaymentsModule
];

const trainerContext = {
  profile: { name: "Trainer", role: "trainer", uid: "trainer-uid" },
  settings: { gymName: "Smoke Gym", currency: "INR" },
  services: { mode: "local" },
  data: makeData(),
  myTrainer: { id: "t1", uid: "trainer-uid", name: "Trainer", status: "Active" },
  myTrainerId: "t1"
};
trainerContext.data.trainers = [trainerContext.myTrainer];

const trainerModules = [dashboardModule, trainerCheckinModule];

function checkRender(module, context, label) {
  const html = module.render(context);
  if (!html || typeof html !== "string") {
    throw new Error(`Module did not return HTML (${label}).`);
  }
}

for (const module of ownerModules) checkRender(module, ownerContext, "owner");
for (const module of memberModules) checkRender(module, memberContext, "member");
for (const module of trainerModules) checkRender(module, trainerContext, "trainer");

// No-roster-doc yet (status setup path) for both member and trainer.
const pendingMember = { ...memberContext, myMember: null, myMemberId: null, data: makeData() };
for (const module of memberModules) checkRender(module, pendingMember, "member-pending");

const pendingTrainer = { ...trainerContext, myTrainer: null, myTrainerId: null, data: makeData() };
for (const module of trainerModules) checkRender(module, pendingTrainer, "trainer-pending");

console.log("Smoke render passed (owner + member + trainer + pending).");
