import ModuleWorkspace from "../components/ModuleWorkspace";
import CBTStudentInvites from "../components/CBTStudentInvites";
import CBTOpayPinDesk from "../components/CBTOpayPinDesk";

const tabs = [
  {
    id: "overview", label: "Overview", title: "WAEC & JAMB Mock Preparation",
    description: "A revision and practice centre for both school students and independent learners. This is not for official school examinations.",
    items: [
      { title: "WAEC Mock Tests", description: "Practise by subject or topic, or sit a timed exam-style mock using authorized past questions and original practice questions." },
      { title: "JAMB Mock Tests", description: "Choose a UTME subject combination and practise with timed, automatically scored mock tests." },
      { title: "Study Materials", description: "Read revision notes, worked examples and authorized PDFs linked to the questions learners are studying." },
      { title: "Question Bank", description: "Organize questions by WAEC/JAMB, subject, topic, year, content source and difficulty." },
      { title: "Practice Progress", description: "Track each learner's attempts, scores, incorrect answers and weak topics." },
    ],
    note: "All CBT scores are practice scores only. They must not populate official term results. The Result Checker is a separate module.",
  },
  {
    id: "questions", label: "Question Bank", title: "Shared Mock Question Bank",
    description: "Maintain one MEKA practice library that registered school students and outside learners can use.",
    items: [
      { title: "Question Types", description: "Begin with multiple-choice questions, answer keys and explanations. Additional formats can be added after objective mocks are reliable." },
      { title: "Exam Classification", description: "Label content by exam (WAEC or JAMB), subject, syllabus topic, source type and applicable year." },
      { title: "Content Quality", description: "Review imported questions and explanations before learners can access them." },
      { title: "Rights & Licensing", description: "Use authentic past questions only when MEKA has redistribution rights; otherwise supply original exam-style questions." },
    ],
    note: "The actual question database, import flow, publisher permissions and answer-protection rules will be implemented next. No past-question collection has been imported.",
  },
  {
    id: "materials", label: "Study Materials", title: "Exam Revision Materials",
    description: "Provide the learning resources students need before and after practice tests.",
    items: [
      { title: "Subject Notes", description: "Organize explanations and topic summaries by examination syllabus." },
      { title: "Worked Solutions", description: "Link questions to step-by-step corrections and recommended revision content." },
      { title: "PDF Resources", description: "Upload MEKA-owned or appropriately licensed revision files." },
      { title: "Audience Access", description: "Share platform materials with both learner types; keep a school's private resources restricted to that school." },
    ],
  },
  {
    id: "waec", label: "WAEC Mocks", title: "WAEC Mock Practice",
    description: "Prepare students using authorized WAEC past questions and original questions designed around relevant syllabus topics.",
    items: [
      { title: "Topic Practice", description: "Select a subject and topic to practise without a high-pressure timer." },
      { title: "Full Mock", description: "Attempt a timed, exam-style objective mock with shuffled questions." },
      { title: "Corrections", description: "See results and explanations after submission." },
      { title: "Past-question Metadata", description: "Record year and source where question rights are verified, without presenting original questions as official leaked future papers." },
    ],
    note: "No official or future WAEC examination paper is available through this module.",
  },
  {
    id: "jamb", label: "JAMB Mocks", title: "JAMB / UTME Mock Practice",
    description: "Prepare with a configurable UTME-style subject combination and timed objective mocks.",
    items: [
      { title: "Subject Combination", description: "Allow learners to choose Use of English and three other eligible practice subjects." },
      { title: "Timed Mock", description: "Present a mock exam with saved answers, navigation, and automatic submission when time expires." },
      { title: "Score Breakdown", description: "Display performance by subject and topic with explanations after submission." },
      { title: "Question Sources", description: "Use properly licensed past questions or original JAMB-style practice content, with clear attribution." },
    ],
    note: "Mock scores indicate practice performance, not official JAMB scores or predictions of upcoming examination questions.",
  },
  {
    id: "performance", label: "Performance", title: "Practice Performance",
    description: "Help every learner identify the subjects and topics they need to revise.",
    items: [
      { title: "My Attempts", description: "Show completed mock sessions, scores, timing and questions reviewed." },
      { title: "Weak Areas", description: "Identify subjects and topics with repeated incorrect answers." },
      { title: "School Cohorts", description: "Let authorized school staff review progress for students securely linked to their school only." },
      { title: "No Official Result Link", description: "Keep WAEC and JAMB mock results separate from term grades and the school Result Checker." },
    ],
  },
];

export default function CBT() {
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <ModuleWorkspace eyebrow="MEKA School • Exam preparation" title="WAEC & JAMB Mock Centre"
        subtitle="Past-question revision, timed practice tests and study materials for school students and independent learners. No official school exams."
        tabs={tabs} />
      <CBTStudentInvites />
      <CBTOpayPinDesk />
    </div>
  );
}
