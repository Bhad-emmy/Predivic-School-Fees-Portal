import ModuleWorkspace from "../components/ModuleWorkspace";

const tabs = [
  {
    id: "overview", label: "Overview", title: "Result Management & Checker",
    description: "Prepare, review, approve, and publish school results safely.",
    items: [
      { title: "Score Entry", description: "Enter continuous assessment and examination scores per student and subject." },
      { title: "Grades & Remarks", description: "Use school-configurable grading bands, subject comments, and report remarks." },
      { title: "Approval", description: "Keep unpublished results private until an authorized administrator approves them." },
      { title: "Result Checker", description: "Publish secure, term-specific student or parent result access with printable report cards." },
    ],
    note: "Result Checker is separate from CBT. WAEC/JAMB mock scores never become official school results. No school results are calculated or published yet."
  },
  {
    id: "entry", label: "Score Entry", title: "Score Entry",
    description: "Academic staff will record assessment marks for the right class, subject, term, and session.",
    items: [
      { title: "Continuous Assessment", description: "Capture CA components using each school's configured weightings." },
      { title: "Examination Marks", description: "Enter official school examination marks separately from WAEC/JAMB mock practice." },
      { title: "Validation", description: "Check score ranges and prevent duplicate records." },
    ],
  },
  {
    id: "grading", label: "Grading", title: "Grading & Report Cards",
    description: "Each school will control how scores become grades and report-card details.",
    items: [
      { title: "Grading Scheme", description: "Configure subject totals, grade thresholds, and interpretations." },
      { title: "Academic Remarks", description: "Add class teacher and principal comments." },
      { title: "Printable Results", description: "Generate term-based report cards without exposing other students." },
    ],
  },
  {
    id: "publication", label: "Publication", title: "Result Approval & Publication",
    description: "Results remain drafts until the school authorizes release.",
    items: [
      { title: "Review Workflow", description: "Check score entry completeness and identify errors." },
      { title: "Publish / Unpublish", description: "Allow authorized school administrators to release or withdraw results." },
      { title: "Audit History", description: "Record changes and publication actions for accountability." },
    ],
  },
  {
    id: "checker", label: "Result Checker", title: "Student & Parent Result Checker",
    description: "Families will view only their own officially published results.",
    items: [
      { title: "Portal Login", description: "Secure result access through the linked parent or future student account." },
      { title: "Optional Checker PIN", description: "Add school-configurable, term-bound checker PINs if the school chooses." },
      { title: "Report Download", description: "View or print a published term report card." },
    ],
  },
];

export default function ResultChecker() {
  return <ModuleWorkspace eyebrow="MEKA School • Academic tools" title="Result Management & Checker"
    subtitle="Continuous assessment, exam grades, report cards, school approval, and secure student result access."
    tabs={tabs} />;
}
