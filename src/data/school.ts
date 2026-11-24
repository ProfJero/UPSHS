// Static, rarely-changing school information. Everything here can be edited in one place.
// Dynamic content (news, events, gallery, downloads, leadership…) lives in Firestore via the CMS.

export const FOUNDED = '1976-10-13';
export const FOUNDED_YEAR = 1976;

export const NAV = [
  {
    label: 'About', href: '/about/',
    children: [
      { label: 'Our story', href: '/about/', desc: 'History, mission and the meaning of our crest', icon: 'book-open' },
      { label: 'Leadership', href: '/about/leadership/', desc: 'The people who lead UNIPRA', icon: 'users' },
      { label: 'Achievements', href: '/about/achievements/', desc: 'Honours, awards and results', icon: 'trophy' },
    ],
  },
  { label: 'Academics', href: '/academics/' },
  { label: 'Student Life', href: '/student-life/' },
  {
    label: 'News & Events', href: '/news/',
    children: [
      { label: 'News & stories', href: '/news/', desc: 'Stories from across the school', icon: 'newspaper' },
      { label: 'Events calendar', href: '/events/', desc: 'Terms, PTA, sports and more', icon: 'calendar' },
      { label: 'Notice board', href: '/announcements/', desc: 'Official announcements', icon: 'megaphone' },
      { label: 'Gallery', href: '/gallery/', desc: 'Moments from school life', icon: 'images' },
    ],
  },
  { label: 'Alumni', href: '/alumni/' },
  { label: 'Contact', href: '/contact/' },
];

export const AUDIENCES = [
  {
    title: 'Students', icon: 'graduation', tone: 'brand',
    blurb: 'Timetables, clubs, notices and everything you need this term.',
    links: [{ label: 'Notice board', href: '/announcements/' }, { label: 'Clubs & societies', href: '/student-life/#clubs' }, { label: 'Downloads', href: '/downloads/' }],
  },
  {
    title: 'Parents & guardians', icon: 'heart', tone: 'flame',
    blurb: 'Term dates, PTA meetings, reporting guidance and how to reach us.',
    links: [{ label: 'School calendar', href: '/events/' }, { label: 'Frequently asked', href: '/faq/' }, { label: 'Contact the office', href: '/contact/' }],
  },
  {
    title: 'Alumni', icon: 'users', tone: 'gold',
    blurb: 'Once a UNIPRAN, always a UNIPRAN. Reconnect and give back.',
    links: [{ label: 'Join the network', href: '/alumni/#join' }, { label: 'Reunions & events', href: '/events/' }, { label: 'Alumni news', href: '/news/' }],
  },
  {
    title: 'Visitors & partners', icon: 'compass', tone: 'sky',
    blurb: 'Learn about the school, find us in Cape Coast and partner with us.',
    links: [{ label: 'About UNIPRA', href: '/about/' }, { label: 'Find us', href: '/contact/#map' }, { label: 'Gallery', href: '/gallery/' }],
  },
];

export const PILLARS = [
  { n: '01', title: 'Learning', icon: 'book-open', text: 'A lifelong commitment to knowledge, inquiry and the discipline of doing things well.' },
  { n: '02', title: 'Character', icon: 'shield', text: 'Integrity, responsibility and respect — values that shape how UNIPRANs carry themselves.' },
  { n: '03', title: 'Service', icon: 'heart', text: 'Knowledge is for sharing. Our motto calls every student to make a difference in the community.' },
];

export const HISTORY = [
  { year: '1970s', title: 'An idea at the University', text: 'The then Faculty of Education of the University of Cape Coast conceived a practice school where student teachers could gain classroom experience.' },
  { year: '1976', title: 'A partnership is formed', text: 'The Ghana Education Service accepted the idea. The University provided buildings and equipment; the Service provided teaching and non-teaching staff.' },
  { year: '13 Oct 1976', title: 'Doors open', text: 'University Practice was formally opened with its first cohort of 112 students studying General Arts and Science in the sixth-form programme.' },
  { year: 'Reforms', title: 'Growing with Ghana', text: 'Through the national education reforms, the school moved from the sixth-form system to today’s Senior High School structure.' },
  { year: 'Today', title: 'The story continues', text: 'Generations of UNIPRANs, teachers and families carry the school’s values of learning, character and service across Ghana and the world.' },
];

export const CREST = [
  { title: 'Gye Nyame', icon: 'sparkles', text: 'The Adinkra symbol at the heart of the crest — “except God” — expresses faith and humility at the foundation of all learning.' },
  { title: 'The torch', icon: 'flame', text: 'Held high in a firm hand, the flame stands for enlightenment: knowledge passed on to light the way for others.' },
  { title: 'The open book', icon: 'book-open', text: 'Scholarship and the school’s roots in teacher education at the University of Cape Coast.' },
  { title: 'The waves', icon: 'globe', text: 'The sea of Cape Coast — our home — and the reach of a UNIPRA education far beyond the shore.' },
  { title: 'Floreat', icon: 'leaf', text: 'Latin for “may it flourish” — our hope for every student and for the school itself.' },
  { title: 'Service to the Community', icon: 'heart', text: 'Our motto, carried on the ribbon: an education is measured by the good it does for others.' },
];

export const PROGRAMMES = [
  { title: 'General Science', icon: 'flask', color: 'sky', text: 'Physics, Chemistry, Biology and Elective Mathematics for future doctors, engineers and researchers.', subjects: ['Physics', 'Chemistry', 'Biology', 'Elective Mathematics'] },
  { title: 'General Arts', icon: 'globe', color: 'brand', text: 'Literature, languages, history, government, geography and economics — the study of people and society.', subjects: ['Literature-in-English', 'Government', 'History', 'Economics', 'Geography', 'French', 'Christian Religious Studies'] },
  { title: 'Business', icon: 'calculator', color: 'gold', text: 'Accounting, business management and economics, preparing students for enterprise and professional study.', subjects: ['Financial Accounting', 'Business Management', 'Cost Accounting', 'Economics'] },
  { title: 'Home Economics', icon: 'home', color: 'flame', text: 'Food and nutrition, clothing and textiles and management in living — science applied to everyday life.', subjects: ['Food & Nutrition', 'Management in Living', 'Clothing & Textiles', 'Biology'] },
  { title: 'Visual Arts', icon: 'palette', color: 'emerald', text: 'Graphic design, picture making, textiles and sculpture for creative thinkers and makers.', subjects: ['General Knowledge in Art', 'Graphic Design', 'Picture Making', 'Textiles'] },
];

export const CORE_SUBJECTS = ['English Language', 'Core Mathematics', 'Integrated Science', 'Social Studies'];

export const FACILITIES = [
  { title: 'Science laboratories', icon: 'flask', text: 'Practical work in Physics, Chemistry and Biology.' },
  { title: 'Library & reading spaces', icon: 'book-open', text: 'Quiet study, research and a culture of reading.' },
  { title: 'ICT centre', icon: 'code', text: 'Computing, digital literacy and research skills.' },
  { title: 'Sports fields', icon: 'activity', text: 'Football, athletics, volleyball and inter-house games.' },
  { title: 'University setting', icon: 'graduation', text: 'Located within the University of Cape Coast community.' },
  { title: 'Assembly & events', icon: 'users', text: 'Space for worship, speech day and cultural events.' },
];

export const CLUBS = [
  { title: 'Science & Maths Quiz', icon: 'flask' },
  { title: 'Debate & Public Speaking', icon: 'mic' },
  { title: 'Drama & Cultural Troupe', icon: 'music' },
  { title: 'Journalism & Press Club', icon: 'newspaper' },
  { title: 'ICT & Coding Club', icon: 'code' },
  { title: 'Red Cross & Health', icon: 'plus' },
  { title: 'Religious fellowships', icon: 'sparkles' },
  { title: 'Environmental Club', icon: 'leaf' },
  { title: 'Entrepreneurship Club', icon: 'briefcase' },
  { title: 'Visual Arts Society', icon: 'palette' },
];

export const SPORTS = ['Football', 'Athletics', 'Volleyball', 'Basketball', 'Handball', 'Table tennis'];

export const FAQ = [
  {
    id: 'admissions', q: 'How do I get admission into University Practice SHS?',
    a: 'The school does not run its own admissions. Placement into all public Senior High Schools in Ghana is done by the Ghana Education Service through the Computerised School Selection and Placement System (CSSPS). Candidates select schools after the BECE and are placed by the CSSPS. Check your placement on the official CSSPS portal.',
    link: { label: 'Visit the CSSPS portal', href: 'https://www.cssps.gov.gh' },
  },
  { id: 'reporting', q: 'When do newly placed students report?', a: 'Reporting dates for first-year students are announced nationally by the Ghana Education Service. Once confirmed, the school publishes reporting guidance and the prospectus on the Notice board and Downloads pages.' },
  { id: 'prospectus', q: 'Where can I get the prospectus and items list?', a: 'Approved forms, the prospectus and other documents are published on the Downloads page whenever they are released by the school.' },
  { id: 'fees', q: 'Do students pay fees?', a: 'Under the Government of Ghana’s Free SHS policy, approved tuition and related fees for students in public senior high schools are covered by government. For any approved costs not covered, follow official communication from the school.' },
  { id: 'results', q: 'How can I check WASSCE results?', a: 'WASSCE results are released by the West African Examinations Council (WAEC) and can be checked on the WAEC results portal with a results checker.' , link: { label: 'WAEC Ghana', href: 'https://www.waecgh.org' } },
  { id: 'transcripts', q: 'I am an old student. How do I request a transcript or attestation?', a: 'Contact the school administration through the Contact page with your full name, year group and programme. The office will advise on the current procedure.' },
  { id: 'visiting', q: 'When are visiting days?', a: 'Visiting days, PTA meetings and other important dates are published on the Events calendar and the Notice board.' },
  { id: 'contact', q: 'How do I contact the school?', a: 'Use the enquiry form on the Contact page, or the telephone and email listed there. Messages are received by the school’s administration.' },
];

export const QUICK_LINKS = [
  { label: 'Events calendar', href: '/events/', icon: 'calendar' },
  { label: 'Notice board', href: '/announcements/', icon: 'megaphone' },
  { label: 'Downloads', href: '/downloads/', icon: 'download' },
  { label: 'FAQs', href: '/faq/', icon: 'info' },
  { label: 'Gallery', href: '/gallery/', icon: 'images' },
  { label: 'Alumni network', href: '/alumni/', icon: 'users' },
];
