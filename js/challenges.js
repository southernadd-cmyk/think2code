window.FlowCode = window.FlowCode || {};
document.addEventListener("DOMContentLoaded", () => {
const FLOWCODE_CHALLENGES = [
    /* ----------------------------- LEVEL 1 — SEQUENCE ----------------------------- */
    {
      "id": 1,
      "diff": 1,
      "title": "🖼️ Print Shop – Poster Quote",
      "skills": ["input","output","sequence"],
      "task": "A print shop charges **£3** per poster. 🖼️\n\nCreate a program that asks the customer how many posters they want to order, calculates the total cost, and displays it.\n\n**Examples:**\n\n**Example 1**\n:Input\n`5`\n:Output\n`15`\n\n**Example 2**\n:Input\n`12`\n:Output\n`36`",
      "pseudocode": "INPUT posters\nSET cost = posters * 3\nOUTPUT cost",
      "success": "Outputs correct total cost"
    },
    {
      "id": 2,
      "diff": 1,
      "title": "🎟️ Helpdesk Ticket Message",
      "skills": ["input","output","sequence"],
      "task": "An IT helpdesk needs to generate ticket messages. 🖥️\n\nCreate a program that asks for the user's name, the device type (e.g., laptop, printer), and the fault description, then outputs a formatted ticket message.\n\n**Examples:**\n\n**Example 1**\n:Inputs\n`Sarah`\n`laptop`\n`screen flickering`\n:Output\n`Ticket created for Sarah with laptop fault: screen flickering`\n\n**Example 2**\n:Inputs\n`Tom`\n`printer`\n`paper jam`\n:Output\n`Ticket created for Tom with printer fault: paper jam`",
      "pseudocode": "INPUT name\nINPUT device\nINPUT fault\nOUTPUT \"Ticket created for \" + name + \" with \" + device + \" fault: \" + fault",
      "success": "Outputs sentence correctly"
    },
    {
      "id": 3,
      "diff": 1,
      "title": "📄 Photocopy Billing",
      "skills": ["input","output","sequence"],
      "task": "A photocopy shop charges **£0.05** per black & white copy 🖨️ and **£0.12** per colour copy 🌈.\n\nCreate a program that asks how many black & white copies and how many colour copies were made, then calculates and displays the total cost (to two decimal places).\n\n**Examples:**\n\n**Example 1**\n:Inputs\n`100` (black & white)\n`20` (colour)\n:Output\n`7.40`\n\n**Example 2**\n:Inputs\n`50` (black & white)\n`10` (colour)\n:Output\n`3.70`",
      "pseudocode": "INPUT bw\nINPUT colour\nSET total = (bw * 0.05) + (colour * 0.12)\nOUTPUT total",
      "success": "Correct calculation"
    },
    {
      "id": 4,
      "diff": 1,
      "title": "⏱️ Minutes to Seconds",
      "skills": ["input","output","sequence"],
      "task": "Create a program that converts minutes into seconds. ⏱️\n\nThe program should ask the user to enter a number of minutes, then calculate and display the equivalent number of seconds.\n\n**Examples:**\n\n**Example 1**\n:Input\n`5`\n:Output\n`300`\n\n**Example 2**\n:Input\n`12`\n:Output\n`720`",
      "pseudocode": "INPUT minutes\nSET seconds = minutes * 60\nOUTPUT seconds",
      "success": "Correct conversion"
    },
    {
      "id": 5,
      "diff": 1,
      "title": "💷 Simple Pay Calculator",
      "skills": ["input","output","sequence"],
      "task": "Create a program that calculates an employee's pay. 💼\n\nThe program should ask for the number of hours worked and the hourly pay rate, then calculate and display the total pay (to two decimal places).\n\n**Examples:**\n\n**Example 1**\n:Inputs\n`40` (hours)\n`12.50` (rate per hour)\n:Output\n`500.00`\n\n**Example 2**\n:Inputs\n`15` (hours)\n`10.00` (rate per hour)\n:Output\n`150.00`",
      "pseudocode": "INPUT hours\nINPUT rate\nSET pay = hours * rate\nOUTPUT pay",
      "success": "Outputs correct pay"
    },

    /* ----------------------------- LEVEL 2 — SELECTION ----------------------------- */
    {
      "id": 6,
      "diff": 2,
      "title": "🎓 Apprenticeship Eligibility",
      "skills": ["selection"],
      "task": "An apprenticeship program requires applicants to be at least **16** years old. 🎓\n\nCreate a program that asks for a student's age and outputs whether they are **Eligible** or **Not eligible**.\n\n**Examples:**\n\n**Example 1**\n:Input\n`17`\n:Output\n`Eligible`\n\n**Example 2**\n:Input\n`15`\n:Output\n`Not eligible`\n\n**Edge case**\n:Input\n`16`\n:Output\n`Eligible`",
      "pseudocode": "INPUT age\nIF age >= 16 THEN\n OUTPUT \"Eligible\"\nELSE\n OUTPUT \"Not eligible\"\nENDIF",
      "success": "Outputs correct eligibility"
    },
    {
      "id": 7,
      "diff": 2,
      "title": "🔒 Password Length Check",
      "skills": ["selection"],
      "task": "A secure system requires passwords to be at least **8** characters long. 🔐\n\nCreate a program that asks for the length of a password and outputs **Too weak** if less than 8, or **OK** otherwise.\n\n**Examples:**\n\n**Example 1**\n:Input\n`6`\n:Output\n`Too weak`\n\n**Example 2**\n:Input\n`10`\n:Output\n`OK`\n\n**Edge case**\n:Input\n`8`\n:Output\n`OK`",
      "pseudocode": "INPUT length\nIF length < 8 THEN\n OUTPUT \"Too weak\"\nELSE\n OUTPUT \"OK\"\nENDIF",
      "success": "Outputs correct message"
    },
    {
      "id": 8,
      "diff": 2,
      "title": "📱 Mobile Usage Discount",
      "skills": ["selection"],
      "task": "A mobile phone company offers a discount to customers who use more than **500** minutes per month. 📞\n\nCreate a program that asks for minutes used and outputs **Apply discount** if over 500, otherwise **No discount**.\n\n**Examples:**\n\n**Example 1**\n:Input\n`650`\n:Output\n`Apply discount`\n\n**Example 2**\n:Input\n`300`\n:Output\n`No discount`\n\n**Edge case**\n:Input\n`500`\n:Output\n`No discount`",
      "pseudocode": "INPUT minutes\nIF minutes > 500 THEN\n OUTPUT \"Apply discount\"\nELSE\n OUTPUT \"No discount\"\nENDIF",
      "success": "Correct decision"
    },
    {
      "id": 9,
      "diff": 2,
      "title": "📝 Exam Grade",
      "skills": ["selection"],
      "task": "An exam requires a score of at least **50** to pass. ✅\n\nCreate a program that asks for a mark and outputs **Pass** if ≥50, otherwise **Fail**.\n\n**Examples:**\n\n**Example 1**\n:Input\n`65`\n:Output\n`Pass`\n\n**Example 2**\n:Input\n`42`\n:Output\n`Fail`\n\n**Edge case**\n:Input\n`50`\n:Output\n`Pass`",
      "pseudocode": "INPUT mark\nIF mark >= 50 THEN\n OUTPUT \"Pass\"\nELSE\n OUTPUT \"Fail\"\nENDIF",
      "success": "Correct grade"
    },
    {
      "id": 10,
      "diff": 2,
      "title": "🛒 IT Shop Delivery Charge",
      "skills": ["selection"],
      "task": "An IT shop offers **free delivery** on orders of **£50** or more. 🚚 Orders under £50 incur a **£4.99** delivery charge.\n\nCreate a program that asks for the order total and outputs the final amount (to two decimal places).\n\n**Examples:**\n\n**Example 1**\n:Input\n`35.00`\n:Output\n`39.99`\n\n**Example 2**\n:Input\n`75.00`\n:Output\n`75.00`\n\n**Edge case**\n:Input\n`49.99`\n:Output\n`54.98`",
      "pseudocode": "INPUT total\nIF total < 50 THEN\n SET total = total + 4.99\nENDIF\nOUTPUT total",
      "success": "Adds delivery when required"
    },

    /* ----------------------------- LEVEL 3 — FOR LOOPS ----------------------------- */
    {
      "id": 11,
      "diff": 3,
      "title": "🧾 Invoice Number Printing",
      "skills": ["loop"],
      "task": "A business needs to print sequential invoice numbers. 🧾\n\nCreate a program that asks how many invoices to generate (N), then outputs the numbers from **1** to **N**, each on a new line.\n\n**Examples:**\n\n**Example 1**\n:Input\n`5`\n:Output\n```\n1\n2\n3\n4\n5\n```\n\n**Example 2**\n:Input\n`3`\n:Output\n```\n1\n2\n3\n```",
      "pseudocode": "INPUT n\nFOR i = 1 TO n\n OUTPUT i\nNEXT i",
      "success": "Correct list output"
    },
    {
      "id": 12,
      "diff": 3,
      "title": "🏷️ Sticker Printer",
      "skills": ["loop"],
      "task": "A label printer needs to print the same message multiple times. 🏷️\n\nCreate a program that asks how many stickers to print (N), then outputs **Sticker printed** exactly N times.\n\n**Examples:**\n\n**Example 1**\n:Input\n`4`\n:Output\n```\nSticker printed\nSticker printed\nSticker printed\nSticker printed\n```\n\n**Example 2**\n:Input\n`2`\n:Output\n```\nSticker printed\nSticker printed\n```",
      "pseudocode": "INPUT n\nFOR i = 1 TO n\n OUTPUT \"Sticker printed\"\nNEXT i",
      "success": "Correct repeat count"
    },
    {
      "id": 13,
      "diff": 3,
      "title": "✖️ Times Table Maker",
      "skills": ["loop"],
      "task": "Create a program that generates a multiplication table.\n\nAsk the user for a number (N), then display N × 1 up to N × 10, each on a new line.\n\n**Examples:**\n\n**Example 1**\n:Input\n`7`\n:Output\n```\n7\n14\n21\n28\n35\n42\n49\n56\n63\n70\n```\n\n**Example 2**\n:Input\n`3`\n:Output\n```\n3\n6\n9\n12\n15\n18\n21\n24\n27\n30\n```",
      "pseudocode": "INPUT n\nFOR i = 1 TO 10\n OUTPUT n * i\nNEXT i",
      "success": "Correct products"
    },
    {
      "id": 14,
      "diff": 3,
      "title": "🔢 Sum of First N Numbers",
      "skills": ["loop"],
      "task": "Create a program that calculates the sum of numbers from **1** to **N**.\n\nAsk the user for N, then display the total.\n\n**Examples:**\n\n**Example 1**\n:Input\n`5`\n:Output\n`15`\n\n**Example 2**\n:Input\n`10`\n:Output\n`55`\n\n**Example 3**\n:Input\n`3`\n:Output\n`6`",
      "pseudocode": "INPUT n\nSET total = 0\nFOR i = 1 TO n\n SET total = total + i\nNEXT i\nOUTPUT total",
      "success": "Correct total"
    },
    {
      "id": 15,
      "diff": 3,
      "title": "⏰ Days Worked Hours Total",
      "skills": ["loop"],
      "task": "An employee needs to track total hours worked across multiple days.\n\nFirst ask how many days, then ask for hours each day, and finally display the total.\n\n**Examples:**\n\n**Example 1**\n:Inputs\n`3`\n`8`\n`6`\n`7`\n:Output\n`21`\n\n**Example 2**\n:Inputs\n`4`\n`5`\n`8`\n`6`\n`7`\n:Output\n`26`",
      "pseudocode": "INPUT days\nSET total = 0\nFOR i = 1 TO days\n INPUT hours\n SET total = total + hours\nNEXT i\nOUTPUT total",
      "success": "Correct accumulation"
    },

    /* ----------------------------- LEVEL 4 — LOOPS + SELECTION ----------------------------- */
    {
      "id": 16,
      "diff": 4,
      "title": "🌐 Website Uptime Monitor",
      "skills": ["loop","selection"],
      "task": "A website monitoring tool checks ping times to ensure good performance. 🌐\n\nCreate a program that checks **exactly 10** ping readings. For each reading, ask for the ping time in milliseconds. Count how many are slow (over **200ms**) and display the count.\n\n**Examples:**\n\n**Example 1**\n:Inputs\n`150`\n`210`\n`180`\n`250`\n`190`\n`220`\n`160`\n`205`\n`170`\n`240`\n:Output\n`5`\n\n**Example 2**\n:Inputs (all ≤ 200)\n`100`\n`150`\n`180`\n`120`\n`190`\n`160`\n`140`\n`170`\n`130`\n`110`\n:Output\n`0`",
      "pseudocode": "SET slow = 0\nFOR i = 1 TO 10\n INPUT ping\n IF ping > 200 THEN\n SET slow = slow + 1\n ENDIF\nNEXT i\nOUTPUT slow",
      "success": "Counts correctly"
    },
    {
      "id": 17,
      "diff": 4,
      "title": "🔑 Password Retry Until Correct",
      "skills": ["loop","selection"],
      "task": "Create a secure login system where the correct password is **letmein**. 🔒\n\nKeep asking for a password until the correct one is entered, then output **Access granted**.\n\n**Examples:**\n\n**Example 1**\n:Inputs\n`hello`\n`password123`\n`letmein`\n:Output\n`Access granted`\n\n**Example 2**\n:Input\n`letmein`\n:Output\n`Access granted`",
      "pseudocode": "SET password = \"letmein\"\nINPUT guess\nWHILE guess != password\n INPUT guess\nENDWHILE\nOUTPUT \"Access granted\"",
      "success": "Loops until correct"
    },
    {
      "id": 18,
      "diff": 4,
      "title": "☕ Loyalty Card Stamp Counter",
      "skills": ["loop","selection"],
      "task": "A coffee shop loyalty card adds a stamp for each **yes**. ☕\n\nRepeatedly ask **yes** or **no**. Add a stamp for each **yes**. Stop on any other answer and display total stamps.\n\n**Examples:**\n\n**Example 1**\n:Inputs\n`yes`\n`yes`\n`yes`\n`no`\n:Output\n`3`\n\n**Example 2**\n:Input\n`no`\n:Output\n`0`",
      "pseudocode": "SET stamps = 0\nINPUT answer\nWHILE answer == \"yes\"\n SET stamps = stamps + 1\n INPUT answer\nENDWHILE\nOUTPUT stamps",
      "success": "Counts stamps correctly"
    },
    {
      "id": 19,
      "diff": 4,
      "title": "🔢 Even Number Finder",
      "skills": ["loop","selection"],
      "task": "Create a program that displays all even numbers up to a given number N (inclusive).\n\n**Examples:**\n\n**Example 1**\n:Input\n`10`\n:Output\n```\n2\n4\n6\n8\n10\n```\n\n**Example 2**\n:Input\n`7`\n:Output\n```\n2\n4\n6\n```",
      "pseudocode": "INPUT n\nFOR i = 1 TO n\n IF i % 2 == 0 THEN\n OUTPUT i\n ENDIF\nNEXT i",
      "success": "Even numbers correct"
    },
    {
      "id": 20,
      "diff": 4,
      "title": "🎯 Guess the Secret Number",
      "skills": ["loop","selection"],
      "task": "Create a number guessing game. The secret number is **7**. 🎲\n\nKeep asking for guesses until correct, then output **Correct**.\n\n**Examples:**\n\n**Example 1**\n:Inputs\n`5`\n`9`\n`7`\n:Output\n`Correct`\n\n**Example 2**\n:Input\n`7`\n:Output\n`Correct`",
      "pseudocode": "SET secret = 7\nINPUT guess\nWHILE guess != secret\n INPUT guess\nENDWHILE\nOUTPUT \"Correct\"",
      "success": "Stops only when correct"
    },

    /* ----------------------------- LEVEL 5 — LISTS / ARRAYS ----------------------------- */
    {
      "id": 21,
      "diff": 5,
      "title": "📚 Store Student Marks",
      "skills": ["list","loop"],
      "task": "A teacher needs to record exam marks for **5** students. 📚\n\nAsk for 5 marks one at a time, store them in a list, then display the list.\n\n**Examples:**\n\n**Example 1**\n:Inputs\n`67`\n`82`\n`54`\n`91`\n`73`\n:Output\n`[67, 82, 54, 91, 73]`\n\n**Example 2**\n:Inputs\n`45`\n`56`\n`78`\n`89`\n`65`\n:Output\n`[45, 56, 78, 89, 65]`",
      "pseudocode": "CREATE list\nFOR i = 1 TO 5\n INPUT mark\n APPEND mark TO list\nNEXT i\nOUTPUT list",
      "success": "Stores 5 marks"
    },
    {
      "id": 22,
      "diff": 5,
      "title": "📊 Average of Marks",
      "skills": ["list","loop"],
      "task": "Calculate the average exam mark for **5** students. 📊\n\nAsk for 5 marks, compute the mean, and display it.\n\n**Examples:**\n\n**Example 1**\n:Inputs\n`60`\n`70`\n`80`\n`90`\n`50`\n:Output\n`70`\n\n**Example 2**\n:Inputs\n`55`\n`65`\n`75`\n`85`\n`95`\n:Output\n`75`",
      "pseudocode": "SET total = 0\nFOR i = 1 TO 5\n INPUT mark\n SET total = total + mark\nNEXT i\nSET average = total / 5\nOUTPUT average",
      "success": "Correct average"
    },
    {
      "id": 23,
      "diff": 5,
      "title": "⭐ Highest Priority Job",
      "skills": ["list","loop","selection"],
      "task": "A job scheduler uses priority values (higher = higher priority). ⭐\n\nFirst ask how many jobs (N), then ask for each priority, and finally display the highest priority.\n\n**Examples:**\n\n**Example 1**\n:Inputs\n`5`\n`3`\n`7`\n`2`\n`9`\n`4`\n:Output\n`9`\n\n**Example 2**\n:Inputs\n`3`\n`5`\n`5`\n`5`\n:Output\n`5`",
      "pseudocode": "INPUT n\nINPUT first\nSET max = first\nFOR i = 2 TO n\n INPUT value\n IF value > max THEN\n SET max = value\n ENDIF\nNEXT i\nOUTPUT max",
      "success": "Outputs maximum"
    },
    {
      "id": 24,
      "diff": 5,
      "title": "📡 Network Latency Average",
      "skills": ["list","loop"],
      "task": "Calculate the average latency across **5** ping readings. 📡\n\nAsk for 5 ping times (ms) and display the average.\n\n**Examples:**\n\n**Example 1**\n:Inputs\n`20`\n`25`\n`30`\n`15`\n`35`\n:Output\n`25`\n\n**Example 2**\n:Inputs\n`50`\n`50`\n`50`\n`50`\n`50`\n:Output\n`50`",
      "pseudocode": "SET total = 0\nFOR i = 1 TO 5\n INPUT ping\n SET total = total + ping\nNEXT i\nOUTPUT total / 5",
      "success": "Correct mean latency"
    },
    {
      "id": 25,
      "diff": 5,
      "title": "🚨 Count Failed Login Attempts",
      "skills": ["list","loop","selection"],
      "task": "A security system logs **PASS** or **FAIL** for 5 login attempts. 🚨\n\nAsk for each result and count how many were **FAIL**.\n\n**Examples:**\n\n**Example 1**\n:Inputs\n`PASS`\n`FAIL`\n`PASS`\n`FAIL`\n`FAIL`\n:Output\n`3`\n\n**Example 2**\n:Inputs (all PASS)\n`PASS`\n`PASS`\n`PASS`\n`PASS`\n`PASS`\n:Output\n`0`",
      "pseudocode": "SET fails = 0\nFOR i = 1 TO 5\n INPUT result\n IF result == \"FAIL\" THEN\n SET fails = fails + 1\n ENDIF\nNEXT i\nOUTPUT fails",
      "success": "Counts fail values"
    },

    /* ----------------------------- LEVEL 6 — CAPSTONE ----------------------------- */
    {
      "id": 26,
      "diff": 6,
      "title": "🔐 Cyber Login Lockout",
      "skills": ["loop","selection"],
      "task": "Create a security system with PIN **1234**. Allow up to **3** attempts. 🔐\n\nIf correct → **Success**. If all 3 wrong → **Locked**.\n\n**Examples:**\n\n**Example 1**\n:Inputs\n`1111`\n`2222`\n`1234`\n:Output\n`Success`\n\n**Example 2**\n:Inputs\n`5555`\n`9999`\n`0000`\n:Output\n`Locked`\n\n**Example 3**\n:Input\n`1234`\n:Output\n`Success`",
      "pseudocode": "SET attempts = 0\nSET pin = 1234\nWHILE attempts < 3\n INPUT guess\n IF guess == pin THEN\n OUTPUT \"Success\"\n STOP\n ENDIF\n SET attempts = attempts + 1\nENDWHILE\nOUTPUT \"Locked\"",
      "success": "Locks after 3 tries"
    },
    {
      "id": 27,
      "diff": 6,
      "title": "💾 USB Order Discount System",
      "skills": ["selection","arithmetic"],
      "task": "A tech supplier sells USB drives at **£6** each with bulk discounts: 💾\n- 10–19 units → **10% off**\n- 20+ units → **20% off**\n\nAsk for quantity, calculate total with discount, display final price (two decimal places).\n\n**Examples:**\n\n**Example 1**\n:Input\n`5`\n:Output\n`30.00`\n\n**Example 2**\n:Input\n`15`\n:Output\n`81.00`\n\n**Example 3**\n:Input\n`25`\n:Output\n`120.00`",
      "pseudocode": "INPUT qty\nSET price = qty * 6\nIF qty >= 20 THEN\n SET price = price * 0.8\nELSE IF qty >= 10 THEN\n SET price = price * 0.9\nENDIF\nOUTPUT price",
      "success": "Correct discount applied"
    },
    {
      "id": 28,
      "diff": 6,
      "title": "🔌 Network Cable Cutter",
      "skills": ["loop","arithmetic"],
      "task": "Cut a cable into **3-meter** sections. 🔌\n\nAsk for total length (meters), output number of full sections and leftover meters.\n\n**Examples:**\n\n**Example 1**\n:Input\n`20`\n:Output\n```\n6\n2\n```\n\n**Example 2**\n:Input\n`15`\n:Output\n```\n5\n0\n```\n\n**Example 3**\n:Input\n`8`\n:Output\n```\n2\n2\n```",
      "pseudocode": "INPUT total\nSET count = 0\nWHILE total >= 3\n SET total = total - 3\n SET count = count + 1\nENDWHILE\nOUTPUT count\nOUTPUT total",
      "success": "Correct cut count and remainder"
    },
    {
      "id": 29,
      "diff": 6,
      "title": "💽 Backup Storage Filler",
      "skills": ["loop","selection","arithmetic"],
      "task": "A backup system has **1000MB** capacity. 💽\n\nKeep asking for file sizes (MB) until adding another would exceed 1000MB. Output total used and number of files stored.\n\n**Examples:**\n\n**Example 1**\n:Inputs\n`300`\n`400`\n`350`\n:Output\n```\n1050\n3\n```\n\n**Example 2**\n:Inputs\n`200`\n`200`\n`200`\n`200`\n`200`\n:Output\n```\n1000\n5\n```",
      "pseudocode": "SET used = 0\nSET files = 0\nWHILE used < 1000\n INPUT size\n SET used = used + size\n SET files = files + 1\nENDWHILE\nOUTPUT used\nOUTPUT files",
      "success": "Stops when capacity reached"
    },
    {
      "id": 30,
      "diff": 6,
      "title": "📅 Project Task Burndown",
      "skills": ["loop","arithmetic","selection"],
      "task": "Track project task completion. 📅\n\nFirst ask total tasks. Then each day ask how many were completed and subtract from remaining. Count days until zero tasks remain, then output days taken.\n\n**Examples:**\n\n**Example 1**\n:Inputs\n`20`\n`5`\n`7`\n`8`\n:Output\n`3`\n\n**Example 2**\n:Inputs\n`15`\n`10`\n`5`\n:Output\n`2`",
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
function markdownToHtml(text) {
    return text
        // Bold **text**
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Inline code `text`
        .replace(/`(.*?)`/g, '<code class="inline-code">$1</code>')
        // Code blocks ```
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // Definition lists: :Term → <dl><dt>Term</dt><dd>...</dd>
        .replace(/^:([^\n]+)\n((?:.*\n?)*?)(?=\n*:|\n\n|$)/gm, '<dl><dt>$1</dt><dd>$2</dd></dl>')
        // Paragraphs and line breaks
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        // Wrap in paragraph if needed
        .replace(/^(.+)$/, '<p>$1</p>')
        .replace(/<p><\/p>/g, '');
}
    
function loadChallenge(ch) {
    document.getElementById("challenge-title").textContent = ch.title;
    document.getElementById("challenge-diff").textContent = "Difficulty " + ch.diff;
    document.getElementById("challenge-task").innerHTML = markdownToHtml(ch.task);
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





