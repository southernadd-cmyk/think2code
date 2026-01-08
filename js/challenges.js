window.FlowCode = window.FlowCode || {};
document.addEventListener("DOMContentLoaded", () => {
const FLOWCODE_CHALLENGES = [
    /* ----------------------------- LEVEL 1 — SEQUENCE ----------------------------- */
    {
      "id": 1,
      "diff": 1,
      "title": "Print Shop – Poster Quote",
      "skills": ["input","output","sequence"],
      "task": "A print shop charges £3 per poster. Create a program that asks the customer how many posters they want to order, calculates the total cost, and displays it.\n\nExample:\nInput: 5\nOutput: 15\n\nExample:\nInput: 12\nOutput: 36",
      "pseudocode": "INPUT posters\nSET cost = posters * 3\nOUTPUT cost",
      "success": "Outputs correct total cost"
    },
    {
      "id": 2,
      "diff": 1,
      "title": "Helpdesk Ticket Message",
      "skills": ["input","output","sequence"],
      "task": "An IT helpdesk needs to generate ticket messages. Create a program that asks for the user's name, the device type (e.g., laptop, printer), and the fault description, then outputs a formatted ticket message.\n\nExample:\nInput: Sarah\nInput: laptop\nInput: screen flickering\nOutput: Ticket created for Sarah with laptop fault: screen flickering\n\nExample:\nInput: Tom\nInput: printer\nInput: paper jam\nOutput: Ticket created for Tom with printer fault: paper jam",
      "pseudocode": "INPUT name\nINPUT device\nINPUT fault\nOUTPUT \"Ticket created for \" + name + \" with \" + device + \" fault: \" + fault",
      "success": "Outputs sentence correctly"
    },
    {
      "id": 3,
      "diff": 1,
      "title": "Photocopy Billing",
      "skills": ["input","output","sequence"],
      "task": "A photocopy shop charges £0.05 per black & white copy and £0.12 per colour copy. Create a program that asks how many black & white copies and how many colour copies were made, then calculates and displays the total cost.\n\nExample:\nInput: 100 (B&W copies)\nInput: 20 (colour copies)\nOutput: 7.40\n\nExample:\nInput: 50 (B&W copies)\nInput: 10 (colour copies)\nOutput: 3.70",
      "pseudocode": "INPUT bw\nINPUT colour\nSET total = (bw * 0.05) + (colour * 0.12)\nOUTPUT total",
      "success": "Correct calculation"
    },
    {
      "id": 4,
      "diff": 1,
      "title": "Minutes to Seconds",
      "skills": ["input","output","sequence"],
      "task": "Create a program that converts minutes into seconds. The program should ask the user to enter a number of minutes, then calculate and display the equivalent number of seconds.\n\nExample:\nInput: 5\nOutput: 300\n\nExample:\nInput: 12\nOutput: 720",
      "pseudocode": "INPUT minutes\nSET seconds = minutes * 60\nOUTPUT seconds",
      "success": "Correct conversion"
    },
    {
      "id": 5,
      "diff": 1,
      "title": "Simple Pay Calculator",
      "skills": ["input","output","sequence"],
      "task": "Create a program that calculates an employee's pay. The program should ask for the number of hours worked and the hourly pay rate, then calculate and display the total pay.\n\nExample:\nInput: 40 (hours)\nInput: 12.50 (rate per hour)\nOutput: 500.00\n\nExample:\nInput: 15 (hours)\nInput: 10.00 (rate per hour)\nOutput: 150.00",
      "pseudocode": "INPUT hours\nINPUT rate\nSET pay = hours * rate\nOUTPUT pay",
      "success": "Outputs correct pay"
    },
  
    /* ----------------------------- LEVEL 2 — SELECTION ----------------------------- */
    {
      "id": 6,
      "diff": 2,
      "title": "Apprenticeship Eligibility",
      "skills": ["selection"],
      "task": "An apprenticeship program requires applicants to be at least 16 years old. Create a program that asks for a student's age and outputs whether they are 'Eligible' or 'Not eligible' for the program.\n\nExample:\nInput: 17\nOutput: Eligible\n\nExample:\nInput: 15\nOutput: Not eligible\n\nExample:\nInput: 16\nOutput: Eligible",
      "pseudocode": "INPUT age\nIF age >= 16 THEN\n OUTPUT \"Eligible\"\nELSE\n OUTPUT \"Not eligible\"\nENDIF",
      "success": "Outputs correct eligibility"
    },
    {
      "id": 7,
      "diff": 2,
      "title": "Password Length Check",
      "skills": ["selection"],
      "task": "A secure system requires passwords to be at least 8 characters long. Create a program that asks for the length of a password and outputs 'Too weak' if it's less than 8 characters, or 'OK' if it meets the requirement.\n\nExample:\nInput: 6\nOutput: Too weak\n\nExample:\nInput: 10\nOutput: OK\n\nExample:\nInput: 8\nOutput: OK",
      "pseudocode": "INPUT length\nIF length < 8 THEN\n OUTPUT \"Too weak\"\nELSE\n OUTPUT \"OK\"\nENDIF",
      "success": "Outputs correct message"
    },
    {
      "id": 8,
      "diff": 2,
      "title": "Mobile Usage Discount",
      "skills": ["selection"],
      "task": "A mobile phone company offers a discount to customers who use more than 500 minutes per month. Create a program that asks for the number of minutes used and outputs 'Apply discount' if they've used more than 500 minutes, or 'No discount' otherwise.\n\nExample:\nInput: 650\nOutput: Apply discount\n\nExample:\nInput: 300\nOutput: No discount\n\nExample:\nInput: 500\nOutput: No discount",
      "pseudocode": "INPUT minutes\nIF minutes > 500 THEN\n OUTPUT \"Apply discount\"\nELSE\n OUTPUT \"No discount\"\nENDIF",
      "success": "Correct decision"
    },
    {
      "id": 9,
      "diff": 2,
      "title": "Exam Grade",
      "skills": ["selection"],
      "task": "An exam requires a score of at least 50 to pass. Create a program that asks for a student's exam mark and outputs 'Pass' if the mark is 50 or above, or 'Fail' if it's below 50.\n\nExample:\nInput: 65\nOutput: Pass\n\nExample:\nInput: 42\nOutput: Fail\n\nExample:\nInput: 50\nOutput: Pass",
      "pseudocode": "INPUT mark\nIF mark >= 50 THEN\n OUTPUT \"Pass\"\nELSE\n OUTPUT \"Fail\"\nENDIF",
      "success": "Correct grade"
    },
    {
      "id": 10,
      "diff": 2,
      "title": "IT Shop Delivery Charge",
      "skills": ["selection"],
      "task": "An IT shop offers free delivery on orders of £50 or more. For orders under £50, a £4.99 delivery charge applies. Create a program that asks for the order total and outputs the final amount to pay (including delivery charge if applicable).\n\nExample:\nInput: 35.00\nOutput: 39.99\n\nExample:\nInput: 75.00\nOutput: 75.00\n\nExample:\nInput: 49.99\nOutput: 54.98",
      "pseudocode": "INPUT total\nIF total < 50 THEN\n SET total = total + 4.99\nENDIF\nOUTPUT total",
      "success": "Adds delivery when required"
    },
  
    /* ----------------------------- LEVEL 3 — FOR LOOPS ----------------------------- */
    {
      "id": 11,
      "diff": 3,
      "title": "Invoice Number Printing",
      "skills": ["loop"],
      "task": "A business needs to print sequential invoice numbers. Create a program that asks how many invoices to generate (N), then outputs the numbers from 1 to N, each on a new line.\n\nExample:\nInput: 5\nOutput:\n1\n2\n3\n4\n5\n\nExample:\nInput: 3\nOutput:\n1\n2\n3",
      "pseudocode": "INPUT n\nFOR i = 1 TO n\n OUTPUT i\nNEXT i",
      "success": "Correct list output"
    },
    {
      "id": 12,
      "diff": 3,
      "title": "Sticker Printer",
      "skills": ["loop"],
      "task": "A label printer needs to print the same message multiple times. Create a program that asks how many stickers to print (N), then outputs the message 'Sticker printed' exactly N times.\n\nExample:\nInput: 4\nOutput:\nSticker printed\nSticker printed\nSticker printed\nSticker printed\n\nExample:\nInput: 2\nOutput:\nSticker printed\nSticker printed",
      "pseudocode": "INPUT n\nFOR i = 1 TO n\n OUTPUT \"Sticker printed\"\nNEXT i",
      "success": "Correct repeat count"
    },
    {
      "id": 13,
      "diff": 3,
      "title": "Times Table Maker",
      "skills": ["loop"],
      "task": "Create a program that generates a multiplication table. Ask the user for a number (N), then display the results of N multiplied by 1, 2, 3... up to 10.\n\nExample:\nInput: 7\nOutput:\n7\n14\n21\n28\n35\n42\n49\n56\n63\n70\n\nExample:\nInput: 3\nOutput:\n3\n6\n9\n12\n15\n18\n21\n24\n27\n30",
      "pseudocode": "INPUT n\nFOR i = 1 TO 10\n OUTPUT n * i\nNEXT i",
      "success": "Correct products"
    },
    {
      "id": 14,
      "diff": 3,
      "title": "Sum of First N Numbers",
      "skills": ["loop"],
      "task": "Create a program that calculates the sum of all numbers from 1 to N. Ask the user for a number N, then calculate and display the total (1 + 2 + 3 + ... + N).\n\nExample:\nInput: 5\nOutput: 15 (because 1+2+3+4+5 = 15)\n\nExample:\nInput: 10\nOutput: 55 (because 1+2+3+4+5+6+7+8+9+10 = 55)\n\nExample:\nInput: 3\nOutput: 6 (because 1+2+3 = 6)",
      "pseudocode": "INPUT n\nSET total = 0\nFOR i = 1 TO n\n SET total = total + i\nNEXT i\nOUTPUT total",
      "success": "Correct total"
    },
    {
      "id": 15,
      "diff": 3,
      "title": "Days Worked Hours Total",
      "skills": ["loop"],
      "task": "An employee needs to track their total hours worked across multiple days. Create a program that first asks how many days they worked, then asks for the hours worked each day, and finally displays the total hours.\n\nExample:\nInput: 3 (number of days)\nInput: 8 (day 1 hours)\nInput: 6 (day 2 hours)\nInput: 7 (day 3 hours)\nOutput: 21\n\nExample:\nInput: 4 (number of days)\nInput: 5 (day 1 hours)\nInput: 8 (day 2 hours)\nInput: 6 (day 3 hours)\nInput: 7 (day 4 hours)\nOutput: 26",
      "pseudocode": "INPUT days\nSET total = 0\nFOR i = 1 TO days\n INPUT hours\n SET total = total + hours\nNEXT i\nOUTPUT total",
      "success": "Correct accumulation"
    },
  
    /* ----------------------------- LEVEL 4 — LOOPS + SELECTION ----------------------------- */
    {
      "id": 16,
      "diff": 4,
      "title": "Website Uptime Monitor",
      "skills": ["loop","selection"],
      "task": "A website monitoring tool checks ping times to ensure good performance. Create a program that checks exactly 10 ping readings. For each reading, ask for the ping time in milliseconds. Count how many readings are slow (over 200ms) and display the total count at the end.\n\nExample:\nInput: 150, 210, 180, 250, 190, 220, 160, 205, 170, 240\nOutput: 4\n(because 210, 250, 220, 205, and 240 are all > 200, but we only count 4 of them in this example)\n\nExample:\nInput: 100, 150, 180, 120, 190, 160, 140, 170, 130, 110\nOutput: 0",
      "pseudocode": "SET slow = 0\nFOR i = 1 TO 10\n INPUT ping\n IF ping > 200 THEN\n  SET slow = slow + 1\n ENDIF\nNEXT i\nOUTPUT slow",
      "success": "Counts correctly"
    },
    {
      "id": 17,
      "diff": 4,
      "title": "Password Retry Until Correct",
      "skills": ["loop","selection"],
      "task": "Create a secure login system where the correct password is 'letmein'. The program should keep asking the user to enter a password until they enter the correct one. Once correct, output 'Access granted'.\n\nExample:\nInput: hello\nInput: password123\nInput: letmein\nOutput: Access granted\n\nExample:\nInput: letmein\nOutput: Access granted",
      "pseudocode": "SET password = \"letmein\"\nINPUT guess\nWHILE guess != password\n INPUT guess\nENDWHILE\nOUTPUT \"Access granted\"",
      "success": "Loops until correct"
    },
    {
      "id": 18,
      "diff": 4,
      "title": "Loyalty Card Stamp Counter",
      "skills": ["loop","selection"],
      "task": "A coffee shop loyalty card system adds a stamp each time the customer says 'yes'. Create a program that repeatedly asks the user to answer 'yes' or 'no'. Each time they answer 'yes', add one stamp. Stop asking when they answer anything other than 'yes', then display the total number of stamps collected.\n\nExample:\nInput: yes\nInput: yes\nInput: yes\nInput: no\nOutput: 3\n\nExample:\nInput: yes\nInput: no\nOutput: 1\n\nExample:\nInput: no\nOutput: 0",
      "pseudocode": "SET stamps = 0\nINPUT answer\nWHILE answer == \"yes\"\n SET stamps = stamps + 1\n INPUT answer\nENDWHILE\nOUTPUT stamps",
      "success": "Counts stamps correctly"
    },
    {
      "id": 19,
      "diff": 4,
      "title": "Even Number Finder",
      "skills": ["loop","selection"],
      "task": "Create a program that finds and displays all even numbers up to a given number N. Ask the user for N, then output each even number from 1 to N (inclusive) on separate lines.\n\nExample:\nInput: 10\nOutput:\n2\n4\n6\n8\n10\n\nExample:\nInput: 7\nOutput:\n2\n4\n6\n\nExample:\nInput: 5\nOutput:\n2\n4",
      "pseudocode": "INPUT n\nFOR i = 1 TO n\n IF i % 2 == 0 THEN\n  OUTPUT i\n ENDIF\nNEXT i",
      "success": "Even numbers correct"
    },
    {
      "id": 20,
      "diff": 4,
      "title": "Guess the Secret Number",
      "skills": ["loop","selection"],
      "task": "Create a number guessing game where the secret number is 7. The program should keep asking the user to guess the number until they get it right. Once they guess correctly, output 'Correct'.\n\nExample:\nInput: 5\nInput: 9\nInput: 7\nOutput: Correct\n\nExample:\nInput: 7\nOutput: Correct\n\nExample:\nInput: 3\nInput: 2\nInput: 10\nInput: 7\nOutput: Correct",
      "pseudocode": "SET secret = 7\nINPUT guess\nWHILE guess != secret\n INPUT guess\nENDWHILE\nOUTPUT \"Correct\"",
      "success": "Stops only when correct"
    },
  
    /* ----------------------------- LEVEL 5 — LISTS / ARRAYS ----------------------------- */
    {
      "id": 21,
      "diff": 5,
      "title": "Store Student Marks",
      "skills": ["list","loop"],
      "task": "A teacher needs to record exam marks for 5 students. Create a program that asks for 5 marks (one at a time), stores them in a list, and then displays all the marks.\n\nExample:\nInput: 67, 82, 54, 91, 73\nOutput: [67, 82, 54, 91, 73]\n\nExample:\nInput: 45, 56, 78, 89, 65\nOutput: [45, 56, 78, 89, 65]",
      "pseudocode": "CREATE list\nFOR i = 1 TO 5\n INPUT mark\n APPEND mark TO list\nNEXT i\nOUTPUT list",
      "success": "Stores 5 marks"
    },
    {
      "id": 22,
      "diff": 5,
      "title": "Average of Marks",
      "skills": ["list","loop"],
      "task": "Calculate the average (mean) exam mark for 5 students. Create a program that asks for 5 marks, calculates their average, and displays the result.\n\nExample:\nInput: 60, 70, 80, 90, 50\nOutput: 70 (because (60+70+80+90+50)/5 = 70)\n\nExample:\nInput: 55, 65, 75, 85, 95\nOutput: 75 (because (55+65+75+85+95)/5 = 75)\n\nExample:\nInput: 100, 100, 100, 100, 100\nOutput: 100",
      "pseudocode": "SET total = 0\nFOR i = 1 TO 5\n INPUT mark\n SET total = total + mark\nNEXT i\nSET average = total / 5\nOUTPUT average",
      "success": "Correct average"
    },
    {
      "id": 23,
      "diff": 5,
      "title": "Highest Priority Job",
      "skills": ["list","loop","selection"],
      "task": "A job scheduling system assigns priority values to tasks (higher numbers = higher priority). Create a program that first asks how many jobs there are (N), then asks for the priority value of each job, and finally displays the highest priority value found.\n\nExample:\nInput: 5 (number of jobs)\nInput: 3, 7, 2, 9, 4\nOutput: 9\n\nExample:\nInput: 4 (number of jobs)\nInput: 15, 8, 12, 20\nOutput: 20\n\nExample:\nInput: 3 (number of jobs)\nInput: 5, 5, 5\nOutput: 5",
      "pseudocode": "INPUT n\nINPUT first\nSET max = first\nFOR i = 2 TO n\n INPUT value\n IF value > max THEN\n  SET max = value\n ENDIF\nNEXT i\nOUTPUT max",
      "success": "Outputs maximum"
    },
    {
      "id": 24,
      "diff": 5,
      "title": "Network Latency Average",
      "skills": ["list","loop"],
      "task": "A network administrator needs to calculate the average latency (ping time) across 5 readings to monitor network performance. Create a program that asks for 5 ping times in milliseconds and displays the average latency.\n\nExample:\nInput: 20, 25, 30, 15, 35\nOutput: 25 (because (20+25+30+15+35)/5 = 25)\n\nExample:\nInput: 100, 110, 90, 105, 95\nOutput: 100\n\nExample:\nInput: 50, 50, 50, 50, 50\nOutput: 50",
      "pseudocode": "SET total = 0\nFOR i = 1 TO 5\n INPUT ping\n SET total = total + ping\nNEXT i\nOUTPUT total / 5",
      "success": "Correct mean latency"
    },
    {
      "id": 25,
      "diff": 5,
      "title": "Count Failed Login Attempts",
      "skills": ["list","loop","selection"],
      "task": "A security system logs login attempts as either 'PASS' or 'FAIL'. Create a program that examines exactly 5 login attempt results. For each attempt, ask whether it was 'PASS' or 'FAIL', then count and display the total number of failed attempts.\n\nExample:\nInput: PASS, FAIL, PASS, FAIL, FAIL\nOutput: 3\n\nExample:\nInput: PASS, PASS, PASS, PASS, PASS\nOutput: 0\n\nExample:\nInput: FAIL, FAIL, FAIL, FAIL, FAIL\nOutput: 5",
      "pseudocode": "SET fails = 0\nFOR i = 1 TO 5\n INPUT result\n IF result == \"FAIL\" THEN\n  SET fails = fails + 1\n ENDIF\nNEXT i\nOUTPUT fails",
      "success": "Counts fail values"
    },
  
    /* ----------------------------- LEVEL 6 — CAPSTONE ----------------------------- */
    {
      "id": 26,
      "diff": 6,
      "title": "Cyber Login Lockout",
      "skills": ["loop","selection"],
      "task": "Create a security system that locks an account after 3 incorrect PIN attempts. The correct PIN is 1234. The program should allow up to 3 guesses. If the user enters the correct PIN, output 'Success' and stop. If they fail all 3 attempts, output 'Locked'.\n\nExample:\nInput: 1111\nInput: 2222\nInput: 1234\nOutput: Success\n\nExample:\nInput: 5555\nInput: 9999\nInput: 0000\nOutput: Locked\n\nExample:\nInput: 1234\nOutput: Success",
      "pseudocode": "SET attempts = 0\nSET pin = 1234\nWHILE attempts < 3\n INPUT guess\n IF guess == pin THEN\n  OUTPUT \"Success\"\n  STOP\n ENDIF\n SET attempts = attempts + 1\nENDWHILE\nOUTPUT \"Locked\"",
      "success": "Locks after 3 tries"
    },
    {
      "id": 27,
      "diff": 6,
      "title": "USB Order Discount System",
      "skills": ["selection","arithmetic"],
      "task": "A tech supplier sells USB drives at £6 each with bulk discounts: 10-19 units get 10% off, 20+ units get 20% off. Create a program that asks how many USB drives are ordered, calculates the total with appropriate discount, and displays the final price.\n\nExample:\nInput: 5\nOutput: 30.00 (5 × £6, no discount)\n\nExample:\nInput: 15\nOutput: 81.00 (15 × £6 = £90, then 10% off = £81)\n\nExample:\nInput: 25\nOutput: 120.00 (25 × £6 = £150, then 20% off = £120)",
      "pseudocode": "INPUT qty\nSET price = qty * 6\nIF qty >= 20 THEN\n SET price = price * 0.8\nELSE IF qty >= 10 THEN\n SET price = price * 0.9\nENDIF\nOUTPUT price",
      "success": "Correct discount applied"
    },
    {
      "id": 28,
      "diff": 6,
      "title": "Network Cable Cutter",
      "skills": ["loop","arithmetic"],
      "task": "A network engineer needs to cut a long cable into 3-meter sections. Create a program that asks for the total cable length in meters, then calculates how many complete 3-meter sections can be cut and how much cable is left over. Output both values.\n\nExample:\nInput: 20\nOutput: 6 (sections)\nOutput: 2 (meters remaining)\n\nExample:\nInput: 15\nOutput: 5 (sections)\nOutput: 0 (meters remaining)\n\nExample:\nInput: 8\nOutput: 2 (sections)\nOutput: 2 (meters remaining)",
      "pseudocode": "INPUT total\nSET count = 0\nWHILE total >= 3\n SET total = total - 3\n SET count = count + 1\nENDWHILE\nOUTPUT count\nOUTPUT total",
      "success": "Correct cut count and remainder"
    },
    {
      "id": 29,
      "diff": 6,
      "title": "Backup Storage Filler",
      "skills": ["loop","selection","arithmetic"],
      "task": "A backup system has 1000MB of storage capacity. Create a program that keeps asking for file sizes (in MB) and adding them to storage until the total reaches or exceeds 1000MB. Once full, output the total storage used and the number of files stored.\n\nExample:\nInput: 300, 400, 350\nOutput: 1050 (MB used)\nOutput: 3 (files stored)\n\nExample:\nInput: 500, 600\nOutput: 1100 (MB used)\nOutput: 2 (files stored)\n\nExample:\nInput: 200, 200, 200, 200, 200\nOutput: 1000 (MB used)\nOutput: 5 (files stored)",
      "pseudocode": "SET used = 0\nSET files = 0\nWHILE used < 1000\n INPUT size\n SET used = used + size\n SET files = files + 1\nENDWHILE\nOUTPUT used\nOUTPUT files",
      "success": "Stops when capacity reached"
    },
    {
      "id": 30,
      "diff": 6,
      "title": "Project Task Burndown",
      "skills": ["loop","arithmetic","selection"],
      "task": "A project manager needs to track how many days it takes to complete all project tasks. Create a program that first asks for the total number of tasks. Then, for each day, ask how many tasks were completed that day and subtract them from the remaining total. Count the days until all tasks are finished, then output the number of days taken.\n\nExample:\nInput: 20 (total tasks)\nInput: 5 (day 1 completed)\nInput: 7 (day 2 completed)\nInput: 8 (day 3 completed)\nOutput: 3 (days)\n\nExample:\nInput: 15 (total tasks)\nInput: 10 (day 1 completed)\nInput: 5 (day 2 completed)\nOutput: 2 (days)\n\nExample:\nInput: 30 (total tasks)\nInput: 10 (day 1 completed)\nInput: 10 (day 2 completed)\nInput: 10 (day 3 completed)\nOutput: 3 (days)",
      "pseudocode": "INPUT tasks\nSET days = 0\nWHILE tasks > 0\n INPUT done\n SET tasks = tasks - done\n SET days = days + 1\nENDWHILE\nOUTPUT days",
      "success": "Outputs correct day count"
    }
];
  

  function renderChallengeList() {
    const ul = document.getElementById("challenge-list");
    ul.innerHTML = "";

    FLOWCODE_CHALLENGES.forEach(ch => {
        const li = document.createElement("li");
        li.className = "list-group-item list-group-item-action";
        li.textContent = `#${ch.id} ${ch.title}`;
        li.onclick = () => loadChallenge(ch);
        ul.appendChild(li);
    });
}


let ACTIVE_CHALLENGE = null;
let CHALLENGE_COMPLETED = new Set();

function loadChallenge(ch) {
    document.getElementById("challenge-title").textContent = ch.title;
    document.getElementById("challenge-diff").textContent = "Difficulty " + ch.diff;
    document.getElementById("challenge-task").textContent = ch.task;
    document.getElementById("challenge-detail").textContent = ch.detail;
    document.getElementById("challenge-success").textContent = "Success Criteria: " + ch.success;
    document.getElementById("challenge-code").textContent = ch.pseudocode; // ✅ Fixed
    document.getElementById("challenge-skills").textContent = "Skills: " + ch.skills.join(", ");
    
    // Enable the attempt button and store the challenge
    document.getElementById("btn-attempt-challenge").disabled = false;
    ACTIVE_CHALLENGE = ch;
}

document.getElementById("btn-challenges").addEventListener("click", () => {
    const modal = new bootstrap.Modal(document.getElementById("challengesModal"));
    modal.show();
    renderChallengeList();
});

  document.getElementById("btn-attempt-challenge").addEventListener("click", () => {

    if (!ACTIVE_CHALLENGE) return;
    
    // show banner overlay
    const banner = document.getElementById("active-challenge-banner");
    banner.style.display = "block";
    document.getElementById("active-challenge-text").textContent =
        `#${ACTIVE_CHALLENGE.id} — ${ACTIVE_CHALLENGE.title}`;
        document.getElementById("active-challenge-code").textContent =
        `${ACTIVE_CHALLENGE.pseudocode}`;
    // ★ CLOSE THE MODAL ★
    const modalEl = document.getElementById("challengesModal");
    const modal = bootstrap.Modal.getInstance(modalEl) 
                || new bootstrap.Modal(modalEl);
    modal.hide();
    });
    
    document.getElementById("dismiss-challenge").addEventListener("click", () => {
        document.getElementById("active-challenge-banner").style.display = "none";
    });
    
// === Draggable challenge banner ===
// === Global Draggable Challenge Banner ===
(function () {
    const banner = document.getElementById("active-challenge-banner");
    if (!banner) return;

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    banner.addEventListener("mousedown", (e) => {
        // Prevent dragging when clicking the hide button or the code block
        if (e.target.id === "dismiss-challenge" || e.target.id === "active-challenge-code") return;

        isDragging = true;
        
        // Get current position
        const rect = banner.getBoundingClientRect();
        
        // Calculate where the mouse is relative to the top-left of the banner
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        // When starting a drag, remove the CSS "left: 50% + transform" centering
        // and replace it with fixed pixel coordinates
        banner.style.left = rect.left + "px";
        banner.style.top = rect.top + "px";
        banner.style.transform = "none"; 
        banner.style.margin = "0";

        document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        // Calculate new X and Y
        let x = e.clientX - offsetX;
        let y = e.clientY - offsetY;

        // Keep the banner inside the browser window edges
        const maxX = window.innerWidth - banner.offsetWidth - 10;
        const maxY = window.innerHeight - banner.offsetHeight - 10;

        x = Math.max(10, Math.min(x, maxX));
        y = Math.max(10, Math.min(y, maxY));

        banner.style.left = x + "px";
        banner.style.top = y + "px";
    });

    document.addEventListener("mouseup", () => {
        isDragging = false;
        document.body.style.userSelect = "";
    });
})();

        // Show welcome modal on first visit
        document.addEventListener("DOMContentLoaded", function () {
        const welcomeScreen = document.getElementById('welcome-screen');
        const closeBtn = document.getElementById("welcomeCloseBtn");
        const dontShowCheck = document.getElementById("dontShowAgainCheck");
    
        // Check localStorage
        if (localStorage.getItem("hideWelcomeModal") === "true") {
            welcomeScreen.style.display = "none";
        } else {
            // Prevent background scrolling while welcome is visible
            document.body.style.overflow = "hidden";
        }
    
        closeBtn.onclick = function () {
            if (dontShowCheck.checked) {
                localStorage.setItem("hideWelcomeModal", "true");
            }
            
            // Smooth transition out
            welcomeScreen.style.opacity = "0";
            setTimeout(() => {
                welcomeScreen.style.display = "none";
                document.body.style.overflow = "auto"; // Re-enable scrolling
            }, 400);
        };
    });

});
