import mongoose from "mongoose";
import dotenv from "dotenv";
import SeoPage from "../MODELS/seoPage.model.js";

dotenv.config();

const seoPages = [
  // ========================================
  // 🎯 SEMESTER PAGES (6 pages)
  // ========================================
  {
    slug: "aktu-semester-3-notes",
    pageType: "semester",
    title: "AKTU Semester 3 Notes | B.Tech 2nd Year All Subjects | AcademicArk",
    h1: "AKTU B.Tech Semester 3 Notes - Complete Study Material",
    metaDescription: "Download free AKTU semester 3 notes for B.Tech CSE, IT, ECE. Includes DBMS, DSA, OS handwritten notes, PYQs 2018-2024 & important questions.",
    keywords: [
      "aktu semester 3 notes",
      "aktu 3rd sem notes",
      "btech 2nd year notes aktu",
      "aktu cse semester 3"
    ],
    introContent: `AKTU Semester 3 marks the beginning of core computer science subjects for B.Tech students. This semester introduces you to fundamental concepts like Database Management Systems (DBMS), Data Structures, and Object-Oriented Programming that form the backbone of software engineering.

Our comprehensive collection includes unit-wise notes, handwritten class notes from top students, previous year question papers from 2018-2024, and important questions predicted by subject experts. All materials are aligned with the latest AKTU syllabus and exam pattern.

Whether you're preparing for mid-semester exams or final exams, these notes cover all units with clear explanations, diagrams, and solved examples. Perfect for last-minute revision and understanding complex topics quickly.`,
    filters: {
      semester: 3,
      university: "AKTU",
      course: "BTECH"  // ✅ FIXED: was "degree"
    },
    faqs: [
      {
        question: "What subjects are in AKTU B.Tech Semester 3?",
        answer: "AKTU Semester 3 includes core subjects like Database Management System (DBMS), Data Structures & Algorithms (DSA), Object-Oriented Programming (OOP), Digital Logic Design, and Mathematics-III. Subject codes vary by branch (CSE, IT, ECE)."
      },
      {
        question: "Are these notes updated for 2025-26 AKTU syllabus?",
        answer: "Yes, all notes are regularly updated to match the latest AKTU syllabus. We add new content within 24 hours of any syllabus changes."
      },
      {
        question: "Can I download these notes for free?",
        answer: "Yes! Basic notes and PYQs are completely free. Premium handwritten notes and detailed solutions require a subscription starting at ₹29 for 14 days."
      }
    ],
    schemaMarkup: {
      "@context": "https://schema.org",
      "@type": "Course",
      "name": "AKTU Semester 3 B.Tech Study Material",
      "description": "Complete notes and study material for AKTU B.Tech Semester 3",
      "provider": {
        "@type": "EducationalOrganization",
        "name": "AcademicArk"
      }
    },
    sitemapPriority: 0.9,
    changeFrequency: "weekly"
  },

  {
    slug: "aktu-semester-4-notes",
    pageType: "semester",
    title: "AKTU Semester 4 Notes | B.Tech 2nd Year Study Material | AcademicArk",
    h1: "AKTU B.Tech Semester 4 Notes - All Subjects",
    metaDescription: "Download AKTU semester 4 notes for B.Tech. Complete OS, COA, TAFL notes with PYQs, handwritten notes, and important questions. Free PDF download.",
    keywords: [
      "aktu semester 4 notes",
      "aktu 4th sem notes",
      "btech semester 4 aktu",
      "aktu second year notes"
    ],
    introContent: `AKTU Semester 4 continues building on the fundamentals with advanced subjects like Operating Systems (OS), Computer Organization & Architecture (COA), and Theory of Automata & Formal Languages (TAFL). This semester is crucial for understanding how computer systems work at the core level.

We provide comprehensive study material including detailed unit-wise notes, quick revision notes, handwritten notes from university toppers, and previous year papers from 2018 to 2024. Each subject includes solved examples, important formulas, and exam-focused content.

Our notes help you understand complex concepts like process scheduling, memory management, assembly language programming, finite automata, and context-free grammars with easy-to-understand explanations and visual diagrams.`,
    filters: {
      semester: 4,
      university: "AKTU",
      course: "BTECH"
    },
    faqs: [
      {
        question: "Which are the most difficult subjects in AKTU Semester 4?",
        answer: "Students often find Theory of Automata & Formal Languages (TAFL) and Operating System (OS) challenging due to their theoretical nature. Our simplified notes and solved PYQs make these subjects easier to understand."
      },
      {
        question: "How many units are there in each subject?",
        answer: "Most AKTU subjects have 5 units. Each unit is covered separately in our notes with important topics, previous year questions, and practice problems."
      }
    ],
    sitemapPriority: 0.9,
    changeFrequency: "weekly"
  },

  {
    slug: "aktu-semester-5-notes",
    pageType: "semester",
    title: "AKTU Semester 5 Notes | B.Tech 3rd Year All Subjects | AcademicArk",
    h1: "AKTU B.Tech Semester 5 Notes - Complete Collection",
    metaDescription: "Download AKTU semester 5 notes for B.Tech CSE. CN, SE, TAFL, DAA complete notes with PYQs, handwritten notes & important questions. Free access.",
    keywords: [
      "aktu semester 5 notes",
      "aktu 5th sem notes",
      "btech 3rd year notes aktu",
      "aktu cse semester 5"
    ],
    introContent: `AKTU Semester 5 introduces advanced computer science subjects that are highly relevant for placements and higher studies. This semester covers Computer Networks (CN), Software Engineering (SE), Design & Analysis of Algorithms (DAA), and other specialization electives.

Our curated collection features in-depth notes for all subjects with real-world examples, case studies, algorithm implementations, network protocols explained simply, and software development methodologies. All content is exam-oriented and placement-focused.

With over 100+ notes, 50+ PYQs, and handwritten class notes, you'll find everything needed to excel in semester exams and build strong fundamentals for technical interviews. Updated regularly with latest AKTU exam patterns.`,
    filters: {
      semester: 5,
      university: "AKTU",
      course: "BTECH"
    },
    faqs: [
      {
        question: "What subjects are in AKTU CSE Semester 5?",
        answer: "AKTU CSE Semester 5 includes Computer Networks (BCS-501), Software Engineering (BCS-502), Design & Analysis of Algorithms (BCS-503), along with department electives and open electives."
      },
      {
        question: "Are these notes helpful for placements?",
        answer: "Absolutely! Semester 5 subjects like DAA and Computer Networks are heavily asked in technical interviews at top companies. Our notes include interview questions and coding problems."
      }
    ],
    sitemapPriority: 0.9,
    changeFrequency: "weekly"
  },

  {
    slug: "aktu-semester-6-notes",
    pageType: "semester",
    title: "AKTU Semester 6 Notes | B.Tech 3rd Year Final Semester | AcademicArk",
    h1: "AKTU B.Tech Semester 6 Notes & Study Material",
    metaDescription: "Download AKTU semester 6 notes for B.Tech final year. ML, AI, Compiler Design complete notes, PYQs 2018-2024 & important questions. Free PDF.",
    keywords: [
      "aktu semester 6 notes",
      "aktu 6th sem notes",
      "btech final year notes aktu",
      "aktu semester 6 cse"
    ],
    introContent: `AKTU Semester 6 is the final semester of third year and focuses on specialization subjects like Machine Learning (ML), Artificial Intelligence (AI), Compiler Design, and Cloud Computing. This semester is crucial for both academic performance and placement preparation.

We offer comprehensive study materials including detailed notes with Python code examples for ML/AI, compiler construction techniques, cloud service models explained, and previous year papers with solutions. All content is industry-relevant and aligned with current tech trends.

Our notes help bridge the gap between theory and practical applications, making you ready for both exams and real-world software development roles. Includes project ideas and implementation guides.`,
    filters: {
      semester: 6,
      university: "AKTU",
      course: "BTECH"
    },
    faqs: [
      {
        question: "Is Semester 6 important for placements?",
        answer: "Yes! Semester 6 subjects like Machine Learning and AI are highly relevant for modern tech roles. Companies often ask questions from these subjects during technical interviews."
      },
      {
        question: "Do you provide practical implementations?",
        answer: "Yes, our ML and AI notes include Python code examples, algorithms implementations, and step-by-step project guides."
      }
    ],
    sitemapPriority: 0.85,
    changeFrequency: "weekly"
  },

  {
    slug: "aktu-semester-1-notes",
    pageType: "semester",
    title: "AKTU Semester 1 Notes | B.Tech 1st Year Study Material | AcademicArk",
    h1: "AKTU B.Tech Semester 1 Notes - First Year Complete Guide",
    metaDescription: "Download AKTU semester 1 notes for B.Tech first year. Physics, Chemistry, Maths, Programming complete notes with PYQs and important questions.",
    keywords: [
      "aktu semester 1 notes",
      "aktu 1st sem notes",
      "btech first year notes aktu",
      "aktu fresher notes"
    ],
    introContent: `Welcome to AKTU B.Tech! Semester 1 lays the foundation for your engineering journey with subjects like Engineering Physics, Engineering Chemistry, Mathematics-I, and Introduction to Programming (C/Python).

Our first-year notes are designed keeping freshers in mind - simple language, step-by-step explanations, plenty of solved examples, and diagrams. We cover all basic concepts thoroughly so you build a strong foundation for upcoming semesters.

Includes previous year papers, important questions, quick revision notes, and formula sheets. Perfect for students transitioning from school to engineering college.`,
    filters: {
      semester: 1,
      university: "AKTU",
      course: "BTECH"
    },
    faqs: [
      {
        question: "Is Semester 1 common for all branches in AKTU?",
        answer: "Yes, AKTU Semester 1 has common subjects for all branches including CSE, IT, ECE, ME, CE. Branch-specific subjects start from Semester 2."
      },
      {
        question: "How difficult is AKTU first semester?",
        answer: "First semester is manageable if you study regularly. Our simplified notes make complex topics easy to understand, especially for students new to engineering."
      }
    ],
    sitemapPriority: 0.85,
    changeFrequency: "weekly"
  },

  {
    slug: "aktu-semester-2-notes",
    pageType: "semester",
    title: "AKTU Semester 2 Notes | B.Tech 1st Year All Subjects | AcademicArk",
    h1: "AKTU B.Tech Semester 2 Notes & Study Resources",
    metaDescription: "Download AKTU semester 2 notes for B.Tech. Maths-II, PPS, EVS complete notes with PYQs, handwritten notes and important questions. Free download.",
    keywords: [
      "aktu semester 2 notes",
      "aktu 2nd sem notes",
      "btech semester 2 aktu",
      "aktu first year second semester"
    ],
    introContent: `AKTU Semester 2 introduces you to core engineering subjects along with continuation of basic sciences. This semester includes Mathematics-II, Programming for Problem Solving (PPS), Engineering Graphics, and Environmental Science.

We provide complete study material including detailed programming concepts with code examples, mathematical theorems with proofs, drawing techniques for engineering graphics, and environmental topics with case studies. All aligned with AKTU syllabus.

Our notes include previous year papers from 2018-2024, solved numericals, important questions chapter-wise, and quick revision material for last-minute preparation.`,
    filters: {
      semester: 2,
      university: "AKTU",
      course: "BTECH"
    },
    faqs: [
      {
        question: "Which programming language is taught in AKTU Semester 2?",
        answer: "AKTU teaches C programming in Programming for Problem Solving (PPS) subject. Our notes include syntax, programs, and solved lab exercises."
      }
    ],
    sitemapPriority: 0.8,
    changeFrequency: "weekly"
  },

  // ========================================
  // 🎯 SUBJECT PAGES (7 pages)
  // ========================================
  {
    slug: "aktu-dbms-notes",
    pageType: "subject",
    title: "AKTU DBMS Notes | Database Management System Complete Guide | AcademicArk",
    h1: "Database Management System (DBMS) Notes for AKTU",
    metaDescription: "Download complete AKTU DBMS notes, PYQs 2018-2024, important questions. Covers ER model, normalization, SQL, transactions. BCS-301 study material.",
    keywords: [
      "aktu dbms notes",
      "database management system aktu",
      "bcs-301 notes",
      "dbms pyq aktu",
      "aktu dbms important questions"
    ],
    introContent: `Database Management System (DBMS) is a core subject in AKTU B.Tech CSE Semester 3 (Subject Code: BCS-301). This subject teaches you how to design, implement, and manage databases - a skill essential for every software developer.

Our comprehensive DBMS notes cover all 5 units including Entity-Relationship (ER) modeling, relational database design, normalization (1NF to BCNF), SQL queries (DDL, DML, DCL), transaction management, concurrency control, and database security. Each concept is explained with real-world examples and university exam pattern.

Includes 15+ previous year papers (2018-2024), 100+ important questions, SQL query practice problems, normalization solved examples, and ER diagram practice sets. Perfect for scoring 25+ marks in DBMS.`,
    filters: {
      subject: "database management system",  // ✅ FIXED: lowercase
      university: "AKTU"
    },
    faqs: [
      {
        question: "What is the syllabus of AKTU DBMS BCS-301?",
        answer: "AKTU DBMS syllabus includes: Unit 1 - ER Model, Unit 2 - Relational Model & SQL, Unit 3 - Normalization, Unit 4 - Transactions & Concurrency, Unit 5 - Database Security & Recovery."
      },
      {
        question: "Is DBMS difficult to score in AKTU?",
        answer: "DBMS is scoring if you practice SQL queries and normalization problems regularly. Our solved PYQs and important questions help you score 25+ easily."
      },
      {
        question: "Which unit is most important in DBMS?",
        answer: "Normalization (Unit 3) and SQL (Unit 2) carry maximum weightage in AKTU exams. Focus on these units for guaranteed marks."
      }
    ],
    schemaMarkup: {
      "@context": "https://schema.org",
      "@type": "Course",
      "name": "DBMS - Database Management System AKTU",
      "description": "Complete DBMS study material for AKTU B.Tech",
      "courseCode": "BCS-301"
    },
    sitemapPriority: 0.95,
    changeFrequency: "weekly"
  },

  {
    slug: "aktu-operating-system-notes",
    pageType: "subject",
    title: "AKTU Operating System Notes | OS Complete Study Material | AcademicArk",
    h1: "Operating System (OS) Notes for AKTU B.Tech",
    metaDescription: "Download AKTU OS notes, PYQs 2018-2024. Process management, CPU scheduling, deadlock, memory management. BCS-402 complete guide with diagrams.",
    keywords: [
      "aktu os notes",
      "operating system aktu",
      "bcs-402 notes",
      "aktu os pyq",
      "operating system important questions aktu"
    ],
    introContent: `Operating System (OS) is taught in AKTU B.Tech CSE Semester 4 (Subject Code: BCS-402). This subject covers how operating systems manage computer hardware and provide services to application software.

Our detailed OS notes cover process management, CPU scheduling algorithms (FCFS, SJF, Round Robin), deadlock prevention and detection, memory management techniques (paging, segmentation), file systems, and disk scheduling. Each algorithm includes step-by-step solved examples and Gantt charts.

Includes 20+ previous year papers with solutions, chapter-wise important questions, algorithm implementations, and comparison tables for easy revision. Essential for both exams and technical interviews.`,
    filters: {
      subject: "operating system",  // ✅ FIXED: lowercase
      university: "AKTU"
    },
    faqs: [
      {
        question: "Which topics are most important in AKTU OS?",
        answer: "CPU Scheduling algorithms, Deadlock handling, Page replacement algorithms, and Disk scheduling are most important. These topics appear in every AKTU exam."
      },
      {
        question: "How to prepare OS for AKTU exams?",
        answer: "Practice solving numerical problems on scheduling algorithms, draw Gantt charts, memorize algorithm steps, and solve at least 5 previous year papers."
      }
    ],
    sitemapPriority: 0.9,
    changeFrequency: "weekly"
  },

  {
    slug: "aktu-daa-notes",
    pageType: "subject",
    title: "AKTU DAA Notes | Design and Analysis of Algorithms | AcademicArk",
    h1: "Design and Analysis of Algorithms (DAA) Notes for AKTU",
    metaDescription: "Download AKTU DAA notes, PYQs, important questions. Covers sorting, graph algorithms, dynamic programming, greedy. BCS-503 complete material.",
    keywords: [
      "aktu daa notes",
      "design and analysis of algorithms aktu",
      "bcs-503 notes",
      "daa pyq aktu",
      "algorithm notes aktu"
    ],
    introContent: `Design and Analysis of Algorithms (DAA) is a crucial subject in AKTU B.Tech CSE Semester 5 (Subject Code: BCS-503). This subject forms the foundation for competitive programming and technical interviews at top companies.

Our comprehensive DAA notes cover asymptotic notation (Big-O, Theta, Omega), sorting algorithms, divide and conquer, dynamic programming, greedy algorithms, graph algorithms (BFS, DFS, Dijkstra, Kruskal), and NP-completeness. Each algorithm includes time complexity analysis and pseudocode.

Includes solved previous year papers, algorithm comparison tables, practice problems with solutions, and coding implementations in C/Python. Perfect for placements and exams.`,
    filters: {
      subject: "design and analysis of algorithms",  // ✅ FIXED: lowercase
      university: "AKTU"
    },
    faqs: [
      {
        question: "Is DAA important for placements?",
        answer: "Yes! DAA is one of the most important subjects for placements. Companies like Amazon, Microsoft, Google heavily test algorithm knowledge in interviews."
      },
      {
        question: "What are the most scoring topics in AKTU DAA?",
        answer: "Dynamic Programming, Greedy Algorithms, and Graph Algorithms are most scoring. Practice standard problems from each topic."
      }
    ],
    sitemapPriority: 0.95,
    changeFrequency: "weekly"
  },

  {
    slug: "aktu-data-structure-notes",
    pageType: "subject",
    title: "AKTU Data Structure Notes | DS Complete Guide with Code | AcademicArk",
    h1: "Data Structure (DS) Notes for AKTU B.Tech",
    metaDescription: "Download AKTU Data Structure notes with C code, PYQs 2018-2024. Array, linked list, stack, queue, tree, graph. BCS-303 study material.",
    keywords: [
      "aktu data structure notes",
      "data structure aktu",
      "bcs-303 notes",
      "ds notes with code aktu",
      "data structure pyq aktu"
    ],
    introContent: `Data Structures is a fundamental subject in AKTU B.Tech CSE Semester 3 (Subject Code: BCS-303). This subject teaches you how to organize and store data efficiently for fast access and modification.

Our notes cover all data structures including arrays, linked lists (single, double, circular), stacks, queues, trees (binary, BST, AVL), graphs, hashing, and sorting/searching algorithms. Each data structure includes C code implementations, operations, time complexity, and applications.

Includes 15+ PYQs with solutions, output-based questions, algorithm implementations, comparison charts, and practice problems. Essential for building strong programming fundamentals.`,
    filters: {
      subject: "data structure",  // ✅ FIXED: lowercase
      university: "AKTU"
    },
    faqs: [
      {
        question: "Is coding required in AKTU Data Structure exam?",
        answer: "Yes, AKTU asks for algorithm/code writing in exams. Practice writing C code for insertion, deletion, and traversal operations for all data structures."
      }
    ],
    sitemapPriority: 0.9,
    changeFrequency: "weekly"
  },

  {
    slug: "aktu-computer-networks-notes",
    pageType: "subject",
    title: "AKTU Computer Networks Notes | CN Complete Guide | AcademicArk",
    h1: "Computer Networks (CN) Notes for AKTU B.Tech",
    metaDescription: "Download AKTU CN notes, PYQs 2018-2024. OSI model, TCP/IP, routing, network security. BCS-501 complete study material with diagrams.",
    keywords: [
      "aktu cn notes",
      "computer networks aktu",
      "bcs-501 notes",
      "aktu network notes",
      "cn pyq aktu"
    ],
    introContent: `Computer Networks (CN) is taught in AKTU B.Tech CSE Semester 5 (Subject Code: BCS-501). This subject explains how computers communicate with each other and forms the backbone of internet and cloud technologies.

Our detailed CN notes cover OSI and TCP/IP models, network topologies, data link layer protocols, IP addressing and subnetting, routing algorithms, transport layer (TCP/UDP), application layer protocols (HTTP, FTP, DNS), and network security. Includes numerical problems and protocol diagrams.

Features 20+ previous year papers, subnetting practice problems, protocol comparisons, important questions, and real-world networking examples. Crucial for both exams and understanding how the internet works.`,
    filters: {
      subject: "computer networks",  // ✅ FIXED: lowercase
      university: "AKTU"
    },
    faqs: [
      {
        question: "Which topics are most important in AKTU Computer Networks?",
        answer: "IP addressing & subnetting, TCP vs UDP, Routing algorithms, and Network Security are most important. These appear in every exam."
      }
    ],
    sitemapPriority: 0.9,
    changeFrequency: "weekly"
  },

  {
    slug: "aktu-tafl-notes",
    pageType: "subject",
    title: "AKTU TAFL Notes | Theory of Automata and Formal Languages | AcademicArk",
    h1: "Theory of Automata & Formal Languages (TAFL) Notes for AKTU",
    metaDescription: "Download AKTU TAFL notes, PYQs. Finite automata, regular expressions, CFG, Turing machines. BCS-401 complete study material simplified.",
    keywords: [
      "aktu tafl notes",
      "theory of automata aktu",
      "bcs-401 notes",
      "automata notes aktu",
      "tafl pyq aktu"
    ],
    introContent: `Theory of Automata and Formal Languages (TAFL) is taught in AKTU B.Tech CSE Semester 4 (Subject Code: BCS-401). This theoretical subject forms the foundation of compiler design and computation theory.

Our simplified TAFL notes cover finite automata (DFA, NFA), regular expressions and languages, context-free grammars (CFG), pushdown automata (PDA), Turing machines, and decidability. Complex concepts explained with state diagrams and step-by-step conversions.

Includes previous year papers, conversion problems (NFA to DFA, RE to FA), grammar derivations, and important theorems with proofs. Makes TAFL easy to understand and score.`,
    filters: {
      subject: "theory of automata and formal languages",  // ✅ FIXED: lowercase, full name
      university: "AKTU"
    },
    faqs: [
      {
        question: "Is TAFL difficult in AKTU?",
        answer: "TAFL can be challenging due to its theoretical nature, but our visual notes with state diagrams make it much easier. Practice conversion problems regularly."
      }
    ],
    sitemapPriority: 0.85,
    changeFrequency: "weekly"
  },

  {
    slug: "aktu-python-notes",
    pageType: "subject",
    title: "AKTU Python Programming Notes | Complete Guide with Code | AcademicArk",
    h1: "Python Programming Notes for AKTU B.Tech",
    metaDescription: "Download AKTU Python notes with code examples, PYQs, important programs. Covers basics to advanced Python. Complete practical guide.",
    keywords: [
      "aktu python notes",
      "python programming aktu",
      "python code examples aktu",
      "python pyq aktu"
    ],
    introContent: `Python Programming is increasingly popular in AKTU curriculum across multiple semesters. Python's simple syntax and powerful libraries make it ideal for beginners and experienced programmers alike.

Our Python notes cover basics (variables, data types, operators), control structures, functions, file handling, object-oriented programming in Python, exception handling, and modules/packages. Includes 100+ code examples and practice programs.

Features previous year questions, lab programs with output, important programs for exams, and mini-project ideas. Perfect for both theory exams and practical assessments.`,
    filters: {
      subject: "python",  // ✅ FIXED: lowercase
      university: "AKTU"
    },
    faqs: [
      {
        question: "Which Python topics are asked in AKTU exams?",
        answer: "File handling, OOP in Python, exception handling, and list/dictionary operations are frequently asked. Practice writing complete programs."
      }
    ],
    sitemapPriority: 0.85,
    changeFrequency: "weekly"
  },

  // ========================================
  // 🎯 CATEGORY PAGES (2 pages)
  // ========================================
  {
    slug: "aktu-pyq",
    pageType: "category",
    title: "AKTU Previous Year Papers (PYQ) | All Branches 2018-2024 | AcademicArk",
    h1: "AKTU Previous Year Question Papers (PYQ) - Complete Collection",
    metaDescription: "Download 100+ AKTU PYQ papers for B.Tech all branches. Year-wise question papers 2018-2024 with solutions. Free PDF download for all subjects.",
    keywords: [
      "aktu pyq",
      "aktu previous year papers",
      "aktu question papers",
      "aktu exam papers",
      "aktu pyq pdf"
    ],
    introContent: `Previous Year Question Papers (PYQ) are the most valuable resource for AKTU exam preparation. Analyzing PYQs helps you understand exam patterns, question trends, important topics, and marking schemes.

Our collection includes 100+ question papers from 2018 to 2024 across all subjects and branches. Each paper is organized year-wise and subject-wise for easy access. Many papers include solved solutions and answer keys.

Regular practice with PYQs can boost your scores by 30-40% as many questions repeat with slight variations. Start solving PYQs at least 15 days before exams for best results.`,
    filters: {
      category: "PYQ",  // ✅ FIXED: matches enum exactly
      university: "AKTU"
    },
    faqs: [
      {
        question: "How many PYQs should I solve for AKTU exams?",
        answer: "Solve at least 5-7 previous year papers per subject. Focus on papers from last 3-4 years as they follow the current syllabus pattern."
      },
      {
        question: "Do questions repeat in AKTU exams?",
        answer: "Yes! Around 40-50% questions are repeated or asked with minor modifications. That's why solving PYQs is crucial."
      },
      {
        question: "Are solutions provided with PYQs?",
        answer: "Many of our PYQs include step-by-step solutions. Premium members get access to solved papers for all subjects."
      }
    ],
    schemaMarkup: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "How many PYQs should I solve for AKTU exams?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Solve at least 5-7 previous year papers per subject."
          }
        }
      ]
    },
    sitemapPriority: 0.95,
    changeFrequency: "weekly"
  },

  {
    slug: "aktu-handwritten-notes",
    pageType: "category",
    title: "AKTU Handwritten Notes | Topper Notes All Subjects | AcademicArk",
    h1: "AKTU Handwritten Notes Collection - Made by Toppers",
    metaDescription: "Download 55+ handwritten notes for AKTU B.Tech. Clear, exam-focused notes made by university toppers. All subjects, all semesters. Free PDF.",
    keywords: [
      "aktu handwritten notes",
      "handwritten notes pdf aktu",
      "topper notes aktu",
      "class notes aktu"
    ],
    introContent: `Handwritten notes are preferred by many students for quick revision and understanding complex topics. Our collection features 55+ high-quality handwritten notes created by AKTU toppers and experienced faculty members.

These notes are concise, well-organized, and focus on important topics that frequently appear in exams. They include clear diagrams, highlighted formulas, solved examples, and key points for easy memorization.

Perfect for last-minute revision before exams, understanding difficult concepts visually, and saving time during preparation. All notes are scanned in high resolution and available as free PDF downloads.`,
    filters: {
      category: "Handwritten Notes",  // ✅ FIXED: matches enum exactly
      university: "AKTU"
    },
    faqs: [
      {
        question: "Are handwritten notes better than typed notes?",
        answer: "Handwritten notes often include visual elements like diagrams, flowcharts, and highlighted key points that make revision easier. They're especially helpful for last-minute preparation."
      },
      {
        question: "Who creates these handwritten notes?",
        answer: "Our handwritten notes are contributed by AKTU toppers, subject experts, and senior students who scored 8+ CGPA."
      }
    ],
    sitemapPriority: 0.9,
    changeFrequency: "weekly"
  }
];

// ========================================
// 🔥 PRODUCTION-SAFE UPSERT LOGIC
// ========================================
const seedSeoPages = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    let created = 0;
    let updated = 0;
    let failed = 0;

    console.log("🚀 Starting SEO page seeding...\n");

    for (const page of seoPages) {
      try {
        const result = await SeoPage.updateOne(
          { slug: page.slug },
          { $set: page },
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          created++;
          console.log(`✅ Created: ${page.slug}`);
        } else if (result.modifiedCount > 0) {
          updated++;
          console.log(`🔄 Updated: ${page.slug}`);
        } else {
          console.log(`⚪ Unchanged: ${page.slug}`);
        }
      } catch (error) {
        failed++;
        console.error(`❌ Failed: ${page.slug} - ${error.message}`);
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("🎉 SEO PAGE SEEDING COMPLETE!");
    console.log("=".repeat(50));
    console.log(`✅ Created: ${created}`);
    console.log(`🔄 Updated: ${updated}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total processed: ${seoPages.length}`);
    console.log("\n📋 Breakdown:");
    console.log("   • Semester pages: 6");
    console.log("   • Subject pages: 7");
    console.log("   • Category pages: 2");
    console.log("\n🎯 Next Steps:");
    console.log("   1. Create dynamic SEO route controller");
    console.log("   2. Generate sitemap.xml");
    console.log("   3. Submit to Google Search Console");
    console.log("   4. Monitor GSC for indexing\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ SEEDING FAILED:", error.message);
    process.exit(1);
  }
};

seedSeoPages();
