// VAULT DEFINITIONS

//Minimum confidence score (0.0 – 1.0) for a vault to be assigned to a document.
const VAULT_THRESHOLD = 0.3;

const VAULTS = [
    {
        id: 'academics',
        label: 'Academics',
        description: 'Course materials, syllabi, timetables, marksheets, transcripts, assignments, and curriculum-related documents.',
        keywords: ['course', 'syllabus', 'marks', 'grade', 'exam', 'lecture', 'timetable', 'transcript', 'assignment', 'curriculum'],
    },
    {
        id: 'finance',
        label: 'Finance',
        description: 'Budgets, invoices, receipts, financial reports, audits, fee structures, and expenditure records.',
        keywords: ['budget', 'invoice', 'receipt', 'expenditure', 'revenue', 'audit', 'fees', 'salary', 'tax', 'payment'],
    },
    {
        id: 'operations',
        label: 'Operations',
        description: 'Day-to-day operational documents, logistics, schedules, maintenance records, and facilities management.',
        keywords: ['operations', 'logistics', 'schedule', 'facility', 'maintenance', 'procurement', 'supply', 'inventory', 'workflow'],
    },
    {
        id: 'governance',
        label: 'Governance & Legal',
        description: 'Policies, regulations, meeting minutes, board resolutions, MoUs, compliance documents, and legal agreements.',
        keywords: ['policy', 'regulation', 'compliance', 'legal', 'contract', 'MoU', 'resolution', 'board', 'minutes', 'statute'],
    },
    {
        id: 'research',
        label: 'Research & Innovation',
        description: 'Research papers, project proposals, theses, dissertations, patents, and innovation reports.',
        keywords: ['research', 'thesis', 'dissertation', 'paper', 'publication', 'patent', 'innovation', 'experiment', 'findings', 'study'],
    },
    {
        id: 'hr',
        label: 'Human Resources',
        description: 'Employee records, recruitment documents, appraisals, leave records, training materials, and HR policies.',
        keywords: ['employee', 'recruitment', 'appraisal', 'leave', 'payroll', 'offer letter', 'training', 'onboarding', 'HR', 'attendance'],
    },
    {
        id: 'engineering',
        label: 'Engineering & Technical',
        description: 'Technical specifications, design documents, CAD files, system architecture, lab manuals, and engineering reports.',
        keywords: ['technical', 'specification', 'design', 'architecture', 'CAD', 'lab', 'circuit', 'engineering', 'diagram', 'blueprint'],
    },
    {
        id: 'marketing',
        label: 'Marketing & Communications',
        description: 'Brochures, newsletters, press releases, social media content, marketing campaigns, and communication materials.',
        keywords: ['brochure', 'newsletter', 'marketing', 'campaign', 'press release', 'advertisement', 'promotion', 'communication', 'media'],
    },
    {
        id: 'it_systems',
        label: 'IT & Systems',
        description: 'IT infrastructure documents, software manuals, network configurations, security policies, and system logs.',
        keywords: ['IT', 'software', 'hardware', 'network', 'security', 'database', 'server', 'configuration', 'API', 'system', 'log', 'cloud'],
    },
    {
        id: 'student_affairs',
        label: 'Student Affairs',
        description: 'Admission records, student applications, hostel documents, scholarships, clubs, and student welfare documents.',
        keywords: ['student', 'admission', 'hostel', 'scholarship', 'club', 'extracurricular', 'welfare', 'counselling', 'placement'],
    },
    {
        id: 'library_archives',
        label: 'Library & Archives',
        description: 'Digitized archives, book catalogs, historical records, reference documents, and library management materials.',
        keywords: ['library', 'archive', 'catalog', 'reference', 'historical', 'record', 'digitized', 'borrow', 'periodical', 'book'],
    },
    {
        id: 'events',
        label: 'Events & Activities',
        description: 'Event planning documents, cultural programs, sports meets, conference proceedings, and workshop materials.',
        keywords: ['event', 'workshop', 'conference', 'seminar', 'sports', 'cultural', 'fest', 'program', 'schedule', 'invitation'],
    },
    {
        id: 'miscellaneous',
        label: 'Miscellaneous',
        description: 'General documents that do not fit clearly into any other category.',
        keywords: ['general', 'misc', 'other', 'uncategorized'],
    },
];

const VAULT_MAP = Object.fromEntries(VAULTS.map((v) => [v.id, v]));

module.exports = { VAULTS, VAULT_MAP, VAULT_THRESHOLD };
