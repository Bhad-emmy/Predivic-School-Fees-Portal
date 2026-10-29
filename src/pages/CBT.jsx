import ModuleWorkspace from "../components/ModuleWorkspace";

const tabs = [
  {
    id: "overview", label: "Overview", title: "CBT & Learning Centre",
    description: "One learning workspace for classroom assessments, exam preparation, and revision.",
    items: [
      { title: "School CBT", description: "Create timed class tests and exams, assign students, and mark objective answers securely." },
      { title: "Study Materials", description: "Organize revision notes and authorized documents by class, subject, topic, and academic session." },
      { title: "WAEC Practice", description: "Subject-based revision and mock examinations with answer explanations." },
      { title: "JAMB Practice", description: "UTME-style timed mock sessions, subject combinations, and progress reviews." },
      { title: "Performance", description: "Track attempts, strengths, weak topics, and progress over time." },
    ],
    note: "Student authentication, secure answer handling, and a tenant-isolated content database will be built before students can take tests.",
  },
  {
    id: "school-exams", label: "School CBT", title: "School CBT",
    description: "Admin and authorized teachers will create exams for the school's own students.",
    items: [
      { title: "Question Bank", description: "Enter or import questions with choices, answers, explanations, subject, class, and topic." },
      { title: "Exam Setup", description: "Set duration, available dates, attempt limit, question order, and class or student eligibility." },
      { title: "Exam Delivery", description: "Save student answers, auto-submit at the deadline, and calculate objective scores on the server." },
      { title: "Release Controls", description: "Choose whether students see scores immediately or only after school approval." },
    ],
  },
  {
    id: "materials", label: "Study Materials", title: "Study Materials",
    description: "A structured library of revision resources for each school.",
    items: [
      { title: "Lesson Notes", description: "Teacher-created notes organized by class, subject, and topic." },
      { title: "PDF Library", description: "Upload school-owned or appropriately licensed PDF revision documents." },
      { title: "Learning Paths", description: "Connect a topic to its notes, practice questions, and revision outcomes." },
      { title: "Access Control", description: "Limit school-private resources to authorized students and staff." },
    ],
  },
  {
    id: "waec", label: "WAEC Practice", title: "WAEC Practice",
    description: "Revision by WAEC subject, topic, and question type.",
    items: [
      { title: "Subjects & Topics", description: "Practice English, Mathematics, Sciences, Arts, and other configured subjects." },
      { title: "Practice Modes", description: "Topic practice, timed mock examinations, and answer review." },
      { title: "Explanations", description: "Show worked solutions and detailed feedback after submission." },
      { title: "Question Rights", description: "Import authentic past questions only from sources licensed for use; original WAEC-style questions are supported." },
    ],
    note: "No WAEC past-question content has been imported or licensed yet.",
  },
  {
    id: "jamb", label: "JAMB Practice", title: "JAMB Practice",
    description: "UTME-style preparation with timed mock sessions and detailed feedback.",
    items: [
      { title: "Subject Combination", description: "Select Use of English and three other configured UTME subjects." },
      { title: "Timed Mock Tests", description: "Practice under a configurable examination timer." },
      { title: "Score Analysis", description: "Review attempted questions, accuracy by topic, and exam readiness." },
      { title: "Question Rights", description: "Use authorized past-question collections or original JAMB-style practice questions." },
    ],
    note: "No JAMB past-question content has been imported or licensed yet.",
  },
  {
    id: "performance", label: "Performance", title: "Learning Performance",
    description: "Assessment and practice analytics will stay private to each school and student.",
    items: [
      { title: "Student Progress", description: "Track practice history and per-subject progress." },
      { title: "Weak Topics", description: "Identify topics requiring revision from scored responses." },
      { title: "School Reports", description: "View class exam completion and performance trends." },
      { title: "Result Integration", description: "Send approved school examination scores to the Result Management module when enabled." },
    ],
  },
];

export default function CBT() {
  return <ModuleWorkspace eyebrow="MEKA School • Academic tools" title="CBT & Learning Centre"
    subtitle="School examinations, study materials, WAEC and JAMB practice — built into your school's workspace."
    tabs={tabs} />;
}
