import { config } from "dotenv";
import { randomUUID } from "crypto";

config({ path: ".env.local" });
config();

/** Bootstrap org id (align with `DEFAULT_ORGANIZATION_ID` in production). */
const ORG_ID = process.env.SEED_ORGANIZATION_ID?.trim() || "org_demo";

type Field = {
  key: string;
  label: string;
  type: "text" | "textarea";
  required?: boolean;
  placeholder?: string;
};

type CatalogRow = {
  slug: string;
  title: string;
  description: string;
  fieldSchema: { fields: Field[] };
  riskDefaults: Record<string, string>;
};

/** Meridian Health — fictional integrated delivery network (demo catalog). */
const CATALOG: CatalogRow[] = [
  {
    slug: "human_data_access",
    title: "Human data access — clinical & analytics",
    description:
      "Read-only access to PHI / clinical data stores with minimum necessary scope.",
    fieldSchema: {
      fields: [
        {
          key: "resource",
          label: "System / dataset",
          type: "text",
          required: true,
          placeholder: "e.g. Epic Cogito analytics extract",
        },
        {
          key: "reason",
          label: "Clinical or operational justification",
          type: "textarea",
          required: true,
        },
        {
          key: "duration_days",
          label: "Access duration (days, JIT)",
          type: "text",
          required: true,
          placeholder: "14",
        },
      ],
    },
    riskDefaults: {
      Classification: "PHI · HIPAA minimum necessary",
      Approvers: "Manager + privacy / data steward",
    },
  },
  {
    slug: "agent_tool_scope",
    title: "AI assistant — tool & data scope",
    description:
      "New MCP tool, connector, or expanded scope for clinical or ops AI assistants.",
    fieldSchema: {
      fields: [
        {
          key: "agent_name",
          label: "Assistant or workflow name",
          type: "text",
          required: true,
          placeholder: "e.g. Ambient documentation — cardiology",
        },
        {
          key: "tool_and_scope",
          label: "Tool and permitted actions",
          type: "text",
          required: true,
          placeholder: "e.g. Epic FHIR read — encounters, limited write notes",
        },
        {
          key: "blast_radius",
          label: "Blast radius & failure modes",
          type: "textarea",
          required: true,
        },
      ],
    },
    riskDefaults: {
      Risk: "High when write paths touch PHI",
      "Policy": "Security architecture review for production",
    },
  },
  {
    slug: "cloud_compute",
    title: "Cloud capacity & budget approval",
    description:
      "New workloads, reserved instances, or environments with finance visibility.",
    fieldSchema: {
      fields: [
        {
          key: "resource_detail",
          label: "Workload / environment",
          type: "textarea",
          required: true,
          placeholder: "e.g. DR replica pair — us-east / us-west",
        },
        {
          key: "estimated_monthly",
          label: "Estimated monthly run rate",
          type: "text",
          required: true,
          placeholder: "e.g. $1,850/mo",
        },
      ],
    },
    riskDefaults: {
      "FinOps": "Tags & chargeback code required",
      "Suggested control": "Non-prod autoscale off-hours",
    },
  },
  {
    slug: "software_license",
    title: "Business software & license",
    description:
      "SAP, RevCycle, coding tools, or named seats for a department.",
    fieldSchema: {
      fields: [
        {
          key: "application",
          label: "Application",
          type: "text",
          required: true,
          placeholder: "e.g. 3M 360 Encompass",
        },
        {
          key: "seats",
          label: "Number of seats / licenses",
          type: "text",
          required: true,
          placeholder: "e.g. 12",
        },
        {
          key: "department",
          label: "Department & cost center",
          type: "text",
          required: true,
        },
        {
          key: "justification",
          label: "Business justification",
          type: "textarea",
          required: true,
        },
      ],
    },
    riskDefaults: {
      Owner: "IT asset management & vendor management",
    },
  },
  {
    slug: "vpn_remote_access",
    title: "VPN & remote connectivity",
    description:
      "Zscaler, Always-On VPN, or vendor jump-box for hybrid clinical staff.",
    fieldSchema: {
      fields: [
        {
          key: "access_type",
          label: "Access type",
          type: "text",
          required: true,
          placeholder: "e.g. ZPA segment — Revenue Cycle",
        },
        {
          key: "user_group",
          label: "Team or role",
          type: "text",
          required: true,
        },
        {
          key: "duration",
          label: "Duration & renewal",
          type: "textarea",
          required: true,
        },
      ],
    },
    riskDefaults: {
      Security: "MFA & device posture required",
    },
  },
  {
    slug: "privileged_account",
    title: "Privileged / break-glass account",
    description:
      "Domain admin, cloud super-user, or emergency break-glass (PAM aligned).",
    fieldSchema: {
      fields: [
        {
          key: "system",
          label: "Target system",
          type: "text",
          required: true,
          placeholder: "e.g. AWS Org master / Active Directory",
        },
        {
          key: "role_level",
          label: "Role / privilege level",
          type: "text",
          required: true,
        },
        {
          key: "justification",
          label: "Justification & incident link (if emergency)",
          type: "textarea",
          required: true,
        },
      ],
    },
    riskDefaults: {
      Control: "PAM vault session recording where applicable",
    },
  },
  {
    slug: "vendor_third_party",
    title: "Third-party vendor access",
    description:
      "BAA, DPA, network/data access for vendors and implementation partners.",
    fieldSchema: {
      fields: [
        {
          key: "vendor_name",
          label: "Vendor / partner name",
          type: "text",
          required: true,
        },
        {
          key: "data_assets",
          label: "Data or systems touched",
          type: "textarea",
          required: true,
        },
        {
          key: "contract_ref",
          label: "MSA / SOW reference",
          type: "text",
          required: true,
          placeholder: "e.g. CTR-2025-8841",
        },
      ],
    },
    riskDefaults: {
      Compliance: "Procurement + privacy sign-off",
    },
  },
  {
    slug: "production_change",
    title: "Production change & deployment",
    description:
      "CHR change ticket tied to Epic, revenue cycle, or public-facing services.",
    fieldSchema: {
      fields: [
        {
          key: "change_summary",
          label: "Change summary",
          type: "text",
          required: true,
        },
        {
          key: "implementation_plan",
          label: "Implementation & rollback",
          type: "textarea",
          required: true,
        },
        {
          key: "maintenance_window",
          label: "Planned window (CT)",
          type: "text",
          required: true,
          placeholder: "e.g. Sun 02:00–04:00 CT",
        },
      ],
    },
    riskDefaults: {
      CAB: "Follow enterprise change calendar",
    },
  },
  {
    slug: "hardware_laptop",
    title: "Laptop & clinician device",
    description:
      "Standard clinical laptop, hot-swap, or specialty imaging workstation.",
    fieldSchema: {
      fields: [
        {
          key: "device_type",
          label: "Device type",
          type: "text",
          required: true,
          placeholder: "e.g. 14\" clinical laptop — encrypted",
        },
        {
          key: "ship_to",
          label: "Ship-to site / mailstop",
          type: "textarea",
          required: true,
        },
        {
          key: "clinical_use",
          label: "Clinical vs administrative use",
          type: "text",
          required: true,
        },
      ],
    },
    riskDefaults: {
      Asset: "Imaging & encryption policy apply",
    },
  },
  {
    slug: "saas_application",
    title: "SaaS / SSO application",
    description: "New enterprise app behind Okta / Entra with group-based roles.",
    fieldSchema: {
      fields: [
        {
          key: "app_name",
          label: "Application name",
          type: "text",
          required: true,
        },
        {
          key: "entitlement",
          label: "Entitlement / AD group",
          type: "text",
          required: true,
        },
        {
          key: "owners",
          label: "Business owner & IT owner",
          type: "text",
          required: true,
        },
      ],
    },
    riskDefaults: {
      IAM: "SCIM provisioning preferred",
    },
  },
  {
    slug: "security_exception",
    title: "Security policy exception",
    description:
      "Time-bound waiver when a control cannot be met (compensating controls).",
    fieldSchema: {
      fields: [
        {
          key: "control",
          label: "Control or policy section",
          type: "text",
          required: true,
        },
        {
          key: "compensating",
          label: "Compensating controls",
          type: "textarea",
          required: true,
        },
        {
          key: "expiry",
          label: "Exception expiry date",
          type: "text",
          required: true,
        },
      ],
    },
    riskDefaults: {
      Risk: "CISO office tracks exception register",
    },
  },
  {
    slug: "physical_access",
    title: "Badge & physical site access",
    description:
      "Data center, PHI storage, or 24/7 clinical support areas.",
    fieldSchema: {
      fields: [
        {
          key: "site",
          label: "Campus / building",
          type: "text",
          required: true,
          placeholder: "e.g. Med Center Tower B — Level 3",
        },
        {
          key: "areas",
          label: "Areas & access level",
          type: "textarea",
          required: true,
        },
        {
          key: "sponsor",
          label: "Sponsoring director",
          type: "text",
          required: true,
        },
      ],
    },
    riskDefaults: {
      Facilities: "Security badging & audit trail",
    },
  },
];

type DemoScenario = {
  slug: string;
  status: string;
  payload: Record<string, unknown>;
  daysAgo: number;
  assignApprover: boolean;
};

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    slug: "human_data_access",
    status: "fulfilled",
    daysAgo: 2,
    assignApprover: false,
    payload: {
      resource: "Snowflake — ED analytics mart (masked)",
      reason: "Q4 readmission dashboard for quality council.",
      duration_days: "30",
    },
  },
  {
    slug: "human_data_access",
    status: "pending_approval",
    daysAgo: 0,
    assignApprover: true,
    payload: {
      resource: "Databricks — population health cohort builder",
      reason: "Care management outreach pilot — HIPAA BA in place.",
      duration_days: "90",
    },
  },
  {
    slug: "agent_tool_scope",
    status: "needs_info",
    daysAgo: 1,
    assignApprover: true,
    payload: {
      agent_name: "Coding assist — profee review",
      tool_and_scope: "Internal FHIR API — read claims, suggest codes",
      blast_radius: "No auto-submit to payer; human in loop only.",
    },
  },
  {
    slug: "agent_tool_scope",
    status: "failed",
    daysAgo: 5,
    assignApprover: false,
    payload: {
      agent_name: "Patient portal chatbot v2",
      tool_and_scope: "Epic MyChart APIs — proposed write appointment",
      blast_radius: "Scope exceeded policy; provisioning rejected.",
    },
  },
  {
    slug: "cloud_compute",
    status: "fulfilled",
    daysAgo: 7,
    assignApprover: false,
    payload: {
      resource_detail: "GPU nodes for imaging AI — non-prod\nRegion: us-east-1",
      estimated_monthly: "$2,400/mo (FinOps code RC-7782)",
    },
  },
  {
    slug: "cloud_compute",
    status: "pending_approval",
    daysAgo: 0,
    assignApprover: true,
    payload: {
      resource_detail: "Redis cluster — patient scheduling cache (prod)",
      estimated_monthly: "$420/mo",
    },
  },
  {
    slug: "software_license",
    status: "fulfilled",
    daysAgo: 14,
    assignApprover: false,
    payload: {
      application: "RevCycle clearinghouse connector",
      seats: "8",
      department: "Revenue Cycle — Central Business Office (6600)",
      justification: "835/837 batch monitoring for denials project.",
    },
  },
  {
    slug: "software_license",
    status: "pending_approval",
    daysAgo: 1,
    assignApprover: true,
    payload: {
      application: "Tableau Server — clinician analyst add-on",
      seats: "25",
      department: "Clinical analytics (4400)",
      justification: "Board quality metrics pack.",
    },
  },
  {
    slug: "vpn_remote_access",
    status: "fulfilled",
    daysAgo: 30,
    assignApprover: false,
    payload: {
      access_type: "ZPA — vendor patch window Infosys",
      user_group: "ERP sustainment",
      duration: "90 days — renew with SOW CTR-2025-9102",
    },
  },
  {
    slug: "privileged_account",
    status: "needs_info",
    daysAgo: 0,
    assignApprover: true,
    payload: {
      system: "AWS production workload accounts",
      role_level: "OrgAdmin-equivalent (break-glass)",
      justification: "Planned CMDB reconciliation — attach INC-55231.",
    },
  },
  {
    slug: "vendor_third_party",
    status: "pending_approval",
    daysAgo: 3,
    assignApprover: true,
    payload: {
      vendor_name: "Nordic Consulting",
      data_assets: "Epic read-only interfaces — patient demographics & orders",
      contract_ref: "SOW-2026-MHS-014",
    },
  },
  {
    slug: "production_change",
    status: "fulfilled",
    daysAgo: 1,
    assignApprover: false,
    payload: {
      change_summary: "CHR-44821 — charge capture hotfix",
      implementation_plan:
        "Blue/green switch API gateway; rollback via prior revision.",
      maintenance_window: "Sat 01:00–03:00 CT",
    },
  },
  {
    slug: "production_change",
    status: "pending_approval",
    daysAgo: 0,
    assignApprover: true,
    payload: {
      change_summary: "Network ACL — cardiac catheterization VLAN",
      implementation_plan: "Staged rollout cath lab B → A; vendor on bridge.",
      maintenance_window: "Sun 02:00–04:00 CT",
    },
  },
  {
    slug: "hardware_laptop",
    status: "fulfilled",
    daysAgo: 10,
    assignApprover: false,
    payload: {
      device_type: '14" encrypted clinical laptop — standard image',
      ship_to: "Tower A — Nursing admin — MS 4B-112",
      clinical_use: "Charge nurse — hybrid rounds",
    },
  },
  {
    slug: "saas_application",
    status: "pending_approval",
    daysAgo: 2,
    assignApprover: true,
    payload: {
      app_name: "Qualtrics — patient experience",
      entitlement: "SG-APP-QUALTRICS-EDITOR",
      owners: "CX office (J. Rivera) / IT SaaS (M. Patel)",
    },
  },
  {
    slug: "security_exception",
    status: "failed",
    daysAgo: 6,
    assignApprover: false,
    payload: {
      control: "WAF mandatory on public endpoints",
      compensating: "Legacy vendor appliance — no vendor patch path",
      expiry: "2026-06-30",
    },
  },
  {
    slug: "physical_access",
    status: "fulfilled",
    daysAgo: 4,
    assignApprover: false,
    payload: {
      site: "Med Center — Tower B data center",
      areas: "Cold aisle escorted — badge 24/7",
      sponsor: "Dir. Infrastructure — L. Okonkwo",
    },
  },
  {
    slug: "vpn_remote_access",
    status: "pending_approval",
    daysAgo: 0,
    assignApprover: true,
    payload: {
      access_type: "Always-On VPN — traveling clinicians EMEA",
      user_group: "International medicine fellows",
      duration: "120 days — academic year cohort",
    },
  },
];

async function main() {
  const { count, eq } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const schemaMod = await import("../src/db/schema");
  const { organization, requestType, user } = schemaMod;
  const requestTable = schemaMod.request;

  const [existing] = await db
    .select()
    .from(organization)
    .where(eq(organization.id, ORG_ID))
    .limit(1);

  if (!existing) {
    await db.insert(organization).values({
      id: ORG_ID,
      name: "Meridian Health Systems",
      slug: "demo",
    });
    console.log("Inserted organization", ORG_ID);
  } else {
    if (existing.name === "Demo Org") {
      await db
        .update(organization)
        .set({ name: "Meridian Health Systems" })
        .where(eq(organization.id, ORG_ID));
      console.log("Updated organization display name to Meridian Health Systems");
    } else {
      console.log("Organization already exists, skipping insert.");
    }
  }

  const existingTypes = await db
    .select({ slug: requestType.slug })
    .from(requestType)
    .where(eq(requestType.organizationId, ORG_ID));
  const haveSlug = new Set(existingTypes.map((r) => r.slug));

  const toInsert = CATALOG.filter((c) => !haveSlug.has(c.slug));
  if (toInsert.length === 0) {
    console.log("Catalog complete — all %d tiles already present.", CATALOG.length);
  } else {
    await db.insert(requestType).values(
      toInsert.map((row) => ({
        id: randomUUID(),
        organizationId: ORG_ID,
        slug: row.slug,
        title: row.title,
        description: row.description,
        fieldSchema: row.fieldSchema,
        riskDefaults: row.riskDefaults,
      })),
    );
    console.log("Inserted %d new request types (%d total in catalog).", toInsert.length, CATALOG.length);
  }

  const changeTemplateTable = schemaMod.changeTemplate;
  const CHANGE_CATALOG: {
    slug: string;
    title: string;
    description: string;
    fieldSchema: CatalogRow["fieldSchema"];
  }[] = [
    {
      slug: "reporting_change",
      title: "Reporting & analytics change",
      description:
        "Finance / AP / BI report or semantic change with UAT and prod release gates.",
      fieldSchema: {
        fields: [
          {
            key: "reporting_tool",
            label: "Reporting tool",
            type: "text",
            required: true,
            placeholder: "e.g. Power BI, Looker, Tableau",
          },
          {
            key: "artifact_name",
            label: "Report / dashboard name",
            type: "text",
            required: true,
          },
          {
            key: "change_summary",
            label: "What is changing",
            type: "textarea",
            required: true,
          },
          {
            key: "stakeholders",
            label: "Business owners / reviewers",
            type: "text",
            required: true,
            placeholder: "e.g. AP manager, Controller",
          },
        ],
      },
    },
    {
      slug: "etl_bigquery_change",
      title: "ETL / BigQuery pipeline change",
      description:
        "Data pipeline, dbt, scheduled query, or warehouse object change.",
      fieldSchema: {
        fields: [
          {
            key: "dataset_or_project",
            label: "Project / dataset",
            type: "text",
            required: true,
            placeholder: "e.g. analytics-prod.analytics_mart",
          },
          {
            key: "change_summary",
            label: "Change summary",
            type: "textarea",
            required: true,
          },
          {
            key: "rollback_plan",
            label: "Rollback or mitigation",
            type: "textarea",
            required: true,
          },
        ],
      },
    },
  ];

  const existingChangeTemplates = await db
    .select({ slug: changeTemplateTable.slug })
    .from(changeTemplateTable)
    .where(eq(changeTemplateTable.organizationId, ORG_ID));
  const haveChangeSlug = new Set(existingChangeTemplates.map((r) => r.slug));
  const changeToInsert = CHANGE_CATALOG.filter((c) => !haveChangeSlug.has(c.slug));
  if (changeToInsert.length === 0) {
    console.log(
      "Change templates complete — all %d already present.",
      CHANGE_CATALOG.length,
    );
  } else {
    await db.insert(changeTemplateTable).values(
      changeToInsert.map((row) => ({
        id: randomUUID(),
        organizationId: ORG_ID,
        slug: row.slug,
        title: row.title,
        description: row.description,
        fieldSchema: row.fieldSchema,
      })),
    );
    console.log(
      "Inserted %d change template(s) (%d in seed catalog).",
      changeToInsert.length,
      CHANGE_CATALOG.length,
    );
  }

  const [requestCountRow] = await db
    .select({ n: count() })
    .from(requestTable)
    .where(eq(requestTable.organizationId, ORG_ID));

  const requestCount = Number(requestCountRow?.n ?? 0);
  if (requestCount > 0) {
    console.log(
      "Skipping demo requests — organization already has %d request(s). Delete them first if you want a fresh demo set.",
      requestCount,
    );
    printNextSteps();
    return;
  }

  const orgUsers = await db
    .select({ id: user.id, role: user.role, email: user.email })
    .from(user)
    .where(eq(user.organizationId, ORG_ID));

  if (orgUsers.length === 0) {
    console.log(
      "No users in organization yet — sign up first, then run `npm run db:seed` again to load demo requests.",
    );
    printNextSteps();
    return;
  }

  const requester =
    orgUsers.find((u) => (u.role ?? "requester") === "requester") ??
    orgUsers[0];
  const approverUser =
    orgUsers.find((u) => (u.role ?? "requester") === "approver") ??
    orgUsers.find((u) => u.id !== requester.id) ??
    null;

  const typeRows = await db
    .select({ id: requestType.id, slug: requestType.slug })
    .from(requestType)
    .where(eq(requestType.organizationId, ORG_ID));

  const typeBySlug = new Map(typeRows.map((t) => [t.slug, t.id]));
  for (const d of DEMO_SCENARIOS) {
    if (!typeBySlug.has(d.slug)) {
      console.warn("Skipping demo row — missing type:", d.slug);
    }
  }

  const now = Date.now();
  const rows = DEMO_SCENARIOS.filter((d) => typeBySlug.has(d.slug)).map(
    (d) => ({
      id: randomUUID(),
      organizationId: ORG_ID,
      requestTypeId: typeBySlug.get(d.slug)!,
      requesterId: requester.id,
      assignedApproverId:
        d.assignApprover && approverUser ? approverUser.id : null,
      status: d.status,
      payload: d.payload,
      createdAt: new Date(now - d.daysAgo * 86400000),
      updatedAt: new Date(now - d.daysAgo * 86400000),
    }),
  );

  if (rows.length === 0) {
    console.log("No demo requests to insert.");
    printNextSteps();
    return;
  }

  await db.insert(requestTable).values(rows);
  console.log(
    "Seeded %d demo requests for %s (requester: %s).",
    rows.length,
    requester.email,
    requester.email,
  );
  if (approverUser) {
    console.log("Assigned approver on pending items:", approverUser.email);
  }
  printNextSteps();
}

function printNextSteps() {
  console.log(`
Next steps:
1. Set DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
   SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL, and
   DEFAULT_ORGANIZATION_ID=${ORG_ID} (or DEFAULT_ORGANIZATION_SLUG) — see README.
2. npm run db:push   # or db:migrate (already applied if you ran this after push)
3. npm run dev
4. Sign up at /sign-up (users join the configured default organization).
5. Promote roles in SQL if needed, e.g.:
   UPDATE "user" SET role = 'approver' WHERE email = 'you@company.com';
`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
