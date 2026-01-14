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
  
  // Load completed challenges from localStorage
  function loadCompletedChallenges() {
      const stored = localStorage.getItem('challengesCompleted');
      if (stored) {
          try {
              return new Set(JSON.parse(stored));
          } catch (e) {
              console.error('Error loading completed challenges:', e);
          }
      }
      return new Set();
  }

  // Save completed challenges to localStorage
  function saveCompletedChallenges(completedSet) {
      try {
          localStorage.setItem('challengesCompleted', JSON.stringify(Array.from(completedSet)));
      } catch (e) {
          console.error('Error saving completed challenges:', e);
      }
  }

  let CHALLENGE_COMPLETED = loadCompletedChallenges();
  let ACTIVE_CHALLENGE = null;

  function renderChallengeList() {
    const ul = document.getElementById("challenge-list");
    ul.innerHTML = "";

    FLOWCODE_CHALLENGES.forEach(ch => {
        const li = document.createElement("li");
        li.className = "list-group-item list-group-item-action";
        
        // Check if challenge is completed
        const isCompleted = CHALLENGE_COMPLETED.has(ch.id);
        
        // Create container for challenge item
        const container = document.createElement("div");
        container.style.display = "flex";
        container.style.alignItems = "center";
        container.style.gap = "10px";
        
        // Add checkbox/checkmark
        const checkmark = document.createElement("span");
        if (isCompleted) {
            checkmark.innerHTML = '<i class="fa-solid fa-check-circle text-success"></i>';
            checkmark.style.fontSize = "1.2em";
        } else {
            checkmark.innerHTML = '<i class="fa-regular fa-circle" style="opacity: 0.3;"></i>';
            checkmark.style.fontSize = "1.2em";
        }
        checkmark.style.cursor = "pointer";
        checkmark.onclick = (e) => {
            e.stopPropagation();
            toggleChallengeCompletion(ch.id);
        };
        
        // Challenge text
        const text = document.createElement("span");
        text.textContent = `#${ch.id} ${ch.title}`;
        text.style.flex = "1";
        if (isCompleted) {
            text.style.textDecoration = "line-through";
            text.style.opacity = "0.7";
        }
        
        container.appendChild(checkmark);
        container.appendChild(text);
        li.appendChild(container);
        li.onclick = () => loadChallenge(ch);
        ul.appendChild(li);
    });
}

function toggleChallengeCompletion(challengeId) {
    if (CHALLENGE_COMPLETED.has(challengeId)) {
        CHALLENGE_COMPLETED.delete(challengeId);
    } else {
        CHALLENGE_COMPLETED.add(challengeId);
    }
    saveCompletedChallenges(CHALLENGE_COMPLETED);
    renderChallengeList();
    // Reload current challenge if it's the one being toggled
    if (ACTIVE_CHALLENGE && ACTIVE_CHALLENGE.id === challengeId) {
        loadChallenge(ACTIVE_CHALLENGE);
    }
}
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
    
    // Reset to pseudocode tab
    const pseudocodeTab = document.getElementById('pseudocode-tab');
    const testTab = document.getElementById('test-tab');
    if (pseudocodeTab && testTab) {
        pseudocodeTab.classList.add('active');
        testTab.classList.remove('active');
        document.getElementById('pseudocode-pane').classList.add('show', 'active');
        document.getElementById('test-pane').classList.remove('show', 'active');
    }
    
    // Hide test results
    const testResults = document.getElementById('active-challenge-test-results');
    if (testResults) {
        testResults.style.display = 'none';
    }
    
    // Update complete button and minimize state
    updateActiveChallengeCompleteButton(ACTIVE_CHALLENGE.id);
    if (isActiveChallengeMinimized) {
        restoreActiveChallengeBanner();
    }
    
    // Set up minimize and close buttons
    setupActiveChallengeButtons();
    
    // ★ CLOSE THE MODAL ★
    const modalEl = document.getElementById("challengesModal");
    const modal = bootstrap.Modal.getInstance(modalEl) 
                || new bootstrap.Modal(modalEl);
    modal.hide();
    });
    

// === Active Challenge Banner Minimize/Restore and Complete ===
let isActiveChallengeMinimized = false;

function minimizeActiveChallengeBanner() {
    const banner = document.getElementById("active-challenge-banner");
    if (!banner || isActiveChallengeMinimized) return;
    
    // Store original display state
    const bannerContent = banner.querySelectorAll('#active-challenge-text, #active-challenge-tabs, #active-challenge-tab-content');
    banner.dataset.originalDisplay = banner.style.display;
    
    // Hide content, show only header
    bannerContent.forEach(el => {
        if (el) el.style.display = 'none';
    });
    
    // Update button
    const minimizeBtn = document.getElementById('btn-minimize-active-challenge');
    if (minimizeBtn) {
        minimizeBtn.innerHTML = '<i class="fa-solid fa-window-restore"></i>';
        minimizeBtn.title = 'Restore';
    }
    
    banner.classList.add('active-challenge-minimized');
    isActiveChallengeMinimized = true;
}

function restoreActiveChallengeBanner() {
    const banner = document.getElementById("active-challenge-banner");
    if (!banner || !isActiveChallengeMinimized) return;
    
    // Show all content
    const bannerContent = banner.querySelectorAll('#active-challenge-text, #active-challenge-tabs, #active-challenge-tab-content');
    bannerContent.forEach(el => {
        if (el) el.style.display = '';
    });
    
    // Update button
    const minimizeBtn = document.getElementById('btn-minimize-active-challenge');
    if (minimizeBtn) {
        minimizeBtn.innerHTML = '<i class="fa-solid fa-window-minimize"></i>';
        minimizeBtn.title = 'Minimize';
    }
    
    banner.classList.remove('active-challenge-minimized');
    isActiveChallengeMinimized = false;
}

function updateActiveChallengeCompleteButton(challengeId) {
    const banner = document.getElementById("active-challenge-banner");
    if (!banner) return;
    
    // Remove existing buttons if any
    const existingCompleteBtn = document.getElementById('btn-complete-active-challenge');
    if (existingCompleteBtn) existingCompleteBtn.remove();
    const existingSubmitBtn = document.getElementById('btn-submit-challenge');
    if (existingSubmitBtn) existingSubmitBtn.remove();
    
    const isCompleted = CHALLENGE_COMPLETED.has(challengeId);
    const buttonContainer = document.getElementById("active-challenge-buttons");
    if (!buttonContainer) return;
    
    // Create submit button (only if not completed)
    if (!isCompleted) {
        const submitBtn = document.createElement("button");
        submitBtn.id = 'btn-submit-challenge';
        submitBtn.className = 'btn btn-sm btn-primary w-100 mt-2';
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i>Submit Solution';
        submitBtn.onclick = (e) => {
            e.stopPropagation();
            submitChallengeSolution(challengeId);
        };
        buttonContainer.appendChild(submitBtn);
    }
    
    // Create complete button
    const completeBtn = document.createElement("button");
    completeBtn.id = 'btn-complete-active-challenge';
    completeBtn.className = isCompleted 
        ? 'btn btn-sm btn-outline-success w-100 mt-2' 
        : 'btn btn-sm btn-outline-success w-100 mt-2';
    completeBtn.innerHTML = isCompleted 
        ? '<i class="fa-solid fa-check me-1"></i>Completed'
        : '<i class="fa-regular fa-circle me-1"></i>Mark as Complete';
    completeBtn.onclick = (e) => {
        e.stopPropagation();
        
        // If already completed, close banner and open challenge selection modal
        if (isCompleted) {
            // Close the active challenge banner
        document.getElementById("active-challenge-banner").style.display = "none";
            
            // Open the challenge selection modal
            const modal = new bootstrap.Modal(document.getElementById("challengesModal"));
            modal.show();
            renderChallengeList();
            return;
        }
        
        // Otherwise, toggle completion
        toggleChallengeCompletion(challengeId);
        updateActiveChallengeCompleteButton(challengeId);
        // Refresh the challenge list if modal is open
        const modal = bootstrap.Modal.getInstance(document.getElementById("challengesModal"));
        if (modal && modal._isShown) {
            renderChallengeList();
        }
    };
    
    buttonContainer.appendChild(completeBtn);
}

// Set up minimize and close buttons for active challenge banner
function setupActiveChallengeButtons() {
    const minimizeBtn = document.getElementById("btn-minimize-active-challenge");
    const closeBtn = document.getElementById("btn-close-active-challenge");
    
    // Remove existing listeners by cloning buttons
    if (minimizeBtn) {
        const newMinBtn = minimizeBtn.cloneNode(true);
        minimizeBtn.parentNode.replaceChild(newMinBtn, minimizeBtn);
        newMinBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (isActiveChallengeMinimized) {
                restoreActiveChallengeBanner();
            } else {
                minimizeActiveChallengeBanner();
            }
        });
    }
    
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            document.getElementById("active-challenge-banner").style.display = "none";
        });
    }
}

// Set up buttons when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", setupActiveChallengeButtons);
} else {
    setupActiveChallengeButtons();
}
    
// === Draggable challenge banner ===
// === Global Draggable Challenge Banner ===
(function () {
    const banner = document.getElementById("active-challenge-banner");
    if (!banner) return;

    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    banner.addEventListener("mousedown", (e) => {
        // Prevent dragging when clicking buttons or the code block
        if (e.target.closest('button') || e.target.id === "active-challenge-code") return;

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

// ========== CHALLENGE TESTING SYSTEM ==========

/**
 * Parse challenge examples to understand input/output format
 */
function parseChallengeExamples(challenge) {
    const examples = [];
    const task = challenge.task;
    
    // Look for example patterns: :Input, :Inputs, :Output
    const exampleRegex = /Example \d+[\s\S]*?(?=Example \d+|$)/g;
    const matches = task.match(exampleRegex);
    
    if (!matches) return null;
    
    matches.forEach(match => {
        const example = {};
        
        // Extract inputs (can be :Input or :Inputs)
        const inputMatch = match.match(/:Inputs?\s*\n`([^`]+)`/);
        if (inputMatch) {
            // Single input
            example.inputs = [inputMatch[1].trim()];
        } else {
            // Multiple inputs
            const inputsMatch = match.match(/:Inputs\s*\n((?:`[^`]+`\s*\n?)+)/);
            if (inputsMatch) {
                const inputsText = inputsMatch[1];
                example.inputs = inputsText.match(/`([^`]+)`/g).map(i => i.replace(/`/g, '').trim());
            }
        }
        
        // Extract output
        const outputMatch = match.match(/:Output\s*\n`([^`]+)`/);
        if (outputMatch) {
            example.output = outputMatch[1].trim();
        } else {
            // Multi-line output
            const outputMatch2 = match.match(/:Output\s*\n```\s*\n([\s\S]+?)\n```/);
            if (outputMatch2) {
                example.output = outputMatch2[1].trim();
            }
        }
        
        if (example.inputs && example.output) {
            examples.push(example);
        }
    });
    
    return examples.length > 0 ? examples : null;
}

/**
 * Hardcoded test cases for each challenge
 */
const CHALLENGE_TEST_CASES = {
    1: [ // Print Shop
        { inputs: ['5'], expectedOutput: '15' },
        { inputs: ['12'], expectedOutput: '36' },
        { inputs: ['8'], expectedOutput: '24' },
        { inputs: ['20'], expectedOutput: '60' },
        { inputs: ['1'], expectedOutput: '3' }
    ],
    2: [ // Helpdesk Ticket
        { inputs: ['Sarah', 'laptop', 'screen flickering'], expectedOutput: 'Ticket created for Sarah with laptop fault: screen flickering' },
        { inputs: ['Tom', 'printer', 'paper jam'], expectedOutput: 'Ticket created for Tom with printer fault: paper jam' },
        { inputs: ['Alice', 'mouse', 'not working'], expectedOutput: 'Ticket created for Alice with mouse fault: not working' },
        { inputs: ['Bob', 'keyboard', 'sticky keys'], expectedOutput: 'Ticket created for Bob with keyboard fault: sticky keys' },
        { inputs: ['Emma', 'monitor', 'no display'], expectedOutput: 'Ticket created for Emma with monitor fault: no display' }
    ],
    3: [ // Photocopy Billing
        { inputs: ['100', '20'], expectedOutput: '7.40' },
        { inputs: ['50', '10'], expectedOutput: '3.70' },
        { inputs: ['200', '50'], expectedOutput: '16.00' },
        { inputs: ['75', '15'], expectedOutput: '5.55' },
        { inputs: ['150', '30'], expectedOutput: '11.10' }
    ],
    4: [ // Minutes to Seconds
        { inputs: ['5'], expectedOutput: '300' },
        { inputs: ['12'], expectedOutput: '720' },
        { inputs: ['10'], expectedOutput: '600' },
        { inputs: ['3'], expectedOutput: '180' },
        { inputs: ['15'], expectedOutput: '900' }
    ],
    5: [ // Simple Pay Calculator
        { inputs: ['40', '12.50'], expectedOutput: '500.00' },
        { inputs: ['15', '10.00'], expectedOutput: '150.00' },
        { inputs: ['20', '15.75'], expectedOutput: '315.00' },
        { inputs: ['35', '11.00'], expectedOutput: '385.00' },
        { inputs: ['25', '9.50'], expectedOutput: '237.50' }
    ],
    6: [ // Apprenticeship Eligibility
        { inputs: ['17'], expectedOutput: 'Eligible' },
        { inputs: ['15'], expectedOutput: 'Not eligible' },
        { inputs: ['16'], expectedOutput: 'Eligible' },
        { inputs: ['20'], expectedOutput: 'Eligible' },
        { inputs: ['14'], expectedOutput: 'Not eligible' }
    ],
    7: [ // Password Length Check
        { inputs: ['6'], expectedOutput: 'Too weak' },
        { inputs: ['10'], expectedOutput: 'OK' },
        { inputs: ['8'], expectedOutput: 'OK' },
        { inputs: ['5'], expectedOutput: 'Too weak' },
        { inputs: ['12'], expectedOutput: 'OK' }
    ],
    8: [ // Mobile Usage Discount
        { inputs: ['650'], expectedOutput: 'Apply discount' },
        { inputs: ['300'], expectedOutput: 'No discount' },
        { inputs: ['500'], expectedOutput: 'No discount' },
        { inputs: ['600'], expectedOutput: 'Apply discount' },
        { inputs: ['400'], expectedOutput: 'No discount' }
    ],
    9: [ // Exam Grade
        { inputs: ['65'], expectedOutput: 'Pass' },
        { inputs: ['42'], expectedOutput: 'Fail' },
        { inputs: ['50'], expectedOutput: 'Pass' },
        { inputs: ['75'], expectedOutput: 'Pass' },
        { inputs: ['45'], expectedOutput: 'Fail' }
    ],
    10: [ // IT Shop Delivery Charge
        { inputs: ['35.00'], expectedOutput: '39.99' },
        { inputs: ['75.00'], expectedOutput: '75.00' },
        { inputs: ['49.99'], expectedOutput: '54.98' },
        { inputs: ['50.00'], expectedOutput: '50.00' },
        { inputs: ['25.50'], expectedOutput: '30.49' }
    ],
    11: [ // Invoice Number Printing
        { inputs: ['5'], expectedOutput: '1\n2\n3\n4\n5' },
        { inputs: ['3'], expectedOutput: '1\n2\n3' },
        { inputs: ['7'], expectedOutput: '1\n2\n3\n4\n5\n6\n7' },
        { inputs: ['4'], expectedOutput: '1\n2\n3\n4' },
        { inputs: ['10'], expectedOutput: '1\n2\n3\n4\n5\n6\n7\n8\n9\n10' }
    ],
    12: [ // Sticker Printer
        { inputs: ['4'], expectedOutput: 'Sticker printed\nSticker printed\nSticker printed\nSticker printed' },
        { inputs: ['2'], expectedOutput: 'Sticker printed\nSticker printed' },
        { inputs: ['3'], expectedOutput: 'Sticker printed\nSticker printed\nSticker printed' },
        { inputs: ['5'], expectedOutput: 'Sticker printed\nSticker printed\nSticker printed\nSticker printed\nSticker printed' },
        { inputs: ['1'], expectedOutput: 'Sticker printed' }
    ],
    13: [ // Times Table Maker
        { inputs: ['7'], expectedOutput: '7\n14\n21\n28\n35\n42\n49\n56\n63\n70' },
        { inputs: ['3'], expectedOutput: '3\n6\n9\n12\n15\n18\n21\n24\n27\n30' },
        { inputs: ['5'], expectedOutput: '5\n10\n15\n20\n25\n30\n35\n40\n45\n50' },
        { inputs: ['4'], expectedOutput: '4\n8\n12\n16\n20\n24\n28\n32\n36\n40' },
        { inputs: ['6'], expectedOutput: '6\n12\n18\n24\n30\n36\n42\n48\n54\n60' }
    ],
    14: [ // Sum of First N Numbers
        { inputs: ['5'], expectedOutput: '15' },
        { inputs: ['10'], expectedOutput: '55' },
        { inputs: ['3'], expectedOutput: '6' },
        { inputs: ['7'], expectedOutput: '28' },
        { inputs: ['12'], expectedOutput: '78' }
    ],
    15: [ // Days Worked Hours Total
        { inputs: ['3', '8', '6', '7'], expectedOutput: '21' },
        { inputs: ['4', '5', '8', '6', '7'], expectedOutput: '26' },
        { inputs: ['2', '8', '8'], expectedOutput: '16' },
        { inputs: ['5', '7', '6', '8', '5', '6'], expectedOutput: '32' },
        { inputs: ['3', '9', '7', '8'], expectedOutput: '24' }
    ],
    16: [ // Website Uptime Monitor
        { inputs: ['150', '210', '180', '250', '190', '220', '160', '205', '170', '240'], expectedOutput: '5' },
        { inputs: ['100', '150', '180', '120', '190', '160', '140', '170', '130', '110'], expectedOutput: '0' },
        { inputs: ['200', '201', '199', '200', '200', '201', '199', '200', '200', '201'], expectedOutput: '0' },
        { inputs: ['250', '300', '220', '280', '210', '260', '230', '270', '240', '290'], expectedOutput: '10' },
        { inputs: ['150', '180', '190', '160', '170', '200', '210', '195', '185', '175'], expectedOutput: '2' }
    ],
    17: [ // Password Retry Until Correct
        { inputs: ['hello', 'password123', 'letmein'], expectedOutput: 'Access granted' },
        { inputs: ['letmein'], expectedOutput: 'Access granted' },
        { inputs: ['wrong', 'also wrong', 'still wrong', 'letmein'], expectedOutput: 'Access granted' },
        { inputs: ['test', 'letmein'], expectedOutput: 'Access granted' },
        { inputs: ['123', '456', '789', 'letmein'], expectedOutput: 'Access granted' }
    ],
    18: [ // Loyalty Card Stamp Counter
        { inputs: ['yes', 'yes', 'yes', 'no'], expectedOutput: '3' },
        { inputs: ['no'], expectedOutput: '0' },
        { inputs: ['yes', 'yes', 'stop'], expectedOutput: '2' },
        { inputs: ['yes', 'yes', 'yes', 'yes', 'no'], expectedOutput: '4' },
        { inputs: ['yes', 'no'], expectedOutput: '1' }
    ],
    19: [ // Even Number Finder
        { inputs: ['10'], expectedOutput: '2\n4\n6\n8\n10' },
        { inputs: ['7'], expectedOutput: '2\n4\n6' },
        { inputs: ['15'], expectedOutput: '2\n4\n6\n8\n10\n12\n14' },
        { inputs: ['5'], expectedOutput: '2\n4' },
        { inputs: ['20'], expectedOutput: '2\n4\n6\n8\n10\n12\n14\n16\n18\n20' }
    ],
    20: [ // Guess the Secret Number
        { inputs: ['5', '9', '7'], expectedOutput: 'Correct' },
        { inputs: ['7'], expectedOutput: 'Correct' },
        { inputs: ['1', '2', '3', '4', '5', '6', '7'], expectedOutput: 'Correct' },
        { inputs: ['10', '7'], expectedOutput: 'Correct' },
        { inputs: ['8', '6', '7'], expectedOutput: 'Correct' }
    ],
    21: [ // Store Student Marks
        { inputs: ['67', '82', '54', '91', '73'], expectedOutput: '[67, 82, 54, 91, 73]' },
        { inputs: ['45', '56', '78', '89', '65'], expectedOutput: '[45, 56, 78, 89, 65]' },
        { inputs: ['90', '85', '95', '88', '92'], expectedOutput: '[90, 85, 95, 88, 92]' },
        { inputs: ['50', '60', '70', '80', '90'], expectedOutput: '[50, 60, 70, 80, 90]' },
        { inputs: ['100', '95', '98', '99', '97'], expectedOutput: '[100, 95, 98, 99, 97]' }
    ],
    22: [ // Average of Marks
        { inputs: ['60', '70', '80', '90', '50'], expectedOutput: '70' },
        { inputs: ['55', '65', '75', '85', '95'], expectedOutput: '75' },
        { inputs: ['50', '60', '70', '80', '90'], expectedOutput: '70' },
        { inputs: ['100', '90', '80', '70', '60'], expectedOutput: '80' },
        { inputs: ['45', '55', '65', '75', '85'], expectedOutput: '65' }
    ],
    23: [ // Highest Priority Job
        { inputs: ['5', '3', '7', '2', '9', '4'], expectedOutput: '9' },
        { inputs: ['3', '5', '5', '5'], expectedOutput: '5' },
        { inputs: ['4', '8', '1', '6', '3'], expectedOutput: '8' },
        { inputs: ['10', '5', '15', '20', '12'], expectedOutput: '20' },
        { inputs: ['7', '7', '7'], expectedOutput: '7' }
    ],
    24: [ // Network Latency Average
        { inputs: ['20', '25', '30', '15', '35'], expectedOutput: '25' },
        { inputs: ['50', '50', '50', '50', '50'], expectedOutput: '50' },
        { inputs: ['10', '20', '30', '40', '50'], expectedOutput: '30' },
        { inputs: ['15', '25', '35', '45', '55'], expectedOutput: '35' },
        { inputs: ['5', '10', '15', '20', '25'], expectedOutput: '15' }
    ],
    25: [ // Count Failed Login Attempts
        { inputs: ['PASS', 'FAIL', 'PASS', 'FAIL', 'FAIL'], expectedOutput: '3' },
        { inputs: ['PASS', 'PASS', 'PASS', 'PASS', 'PASS'], expectedOutput: '0' },
        { inputs: ['FAIL', 'FAIL', 'FAIL', 'FAIL', 'FAIL'], expectedOutput: '5' },
        { inputs: ['PASS', 'FAIL', 'PASS', 'PASS', 'FAIL'], expectedOutput: '2' },
        { inputs: ['FAIL', 'PASS', 'FAIL', 'PASS', 'FAIL'], expectedOutput: '3' }
    ],
    26: [ // Cyber Login Lockout
        { inputs: ['1111', '2222', '1234'], expectedOutput: 'Success' },
        { inputs: ['5555', '9999', '0000'], expectedOutput: 'Locked' },
        { inputs: ['1234'], expectedOutput: 'Success' },
        { inputs: ['1111', '1234'], expectedOutput: 'Success' },
        { inputs: ['0000', '1111', '2222'], expectedOutput: 'Locked' }
    ],
    27: [ // USB Order Discount System
        { inputs: ['5'], expectedOutput: '30.00' },
        { inputs: ['15'], expectedOutput: '81.00' },
        { inputs: ['25'], expectedOutput: '120.00' },
        { inputs: ['10'], expectedOutput: '54.00' },
        { inputs: ['20'], expectedOutput: '96.00' }
    ],
    28: [ // Network Cable Cutter
        { inputs: ['20'], expectedOutput: '6\n2' },
        { inputs: ['15'], expectedOutput: '5\n0' },
        { inputs: ['8'], expectedOutput: '2\n2' },
        { inputs: ['12'], expectedOutput: '4\n0' },
        { inputs: ['10'], expectedOutput: '3\n1' }
    ],
    29: [ // Backup Storage Filler
        { inputs: ['300', '400', '350'], expectedOutput: '1050\n3' },
        { inputs: ['200', '200', '200', '200', '200'], expectedOutput: '1000\n5' },
        { inputs: ['500', '400', '300'], expectedOutput: '1200\n3' },
        { inputs: ['250', '250', '250', '250'], expectedOutput: '1000\n4' },
        { inputs: ['600', '500'], expectedOutput: '1100\n2' }
    ],
    30: [ // Project Task Burndown
        { inputs: ['20', '5', '7', '8'], expectedOutput: '3' },
        { inputs: ['15', '10', '5'], expectedOutput: '2' },
        { inputs: ['30', '10', '10', '10'], expectedOutput: '3' },
        { inputs: ['25', '5', '5', '5', '5', '5'], expectedOutput: '5' },
        { inputs: ['12', '6', '6'], expectedOutput: '2' }
    ]
};

/**
 * Get test cases for a challenge (returns 3 random ones from the hardcoded set)
 */
function generateTestCases(challenge, count = 3) {
    const testCases = CHALLENGE_TEST_CASES[challenge.id];
    if (!testCases || testCases.length === 0) {
        return null;
    }
    
    // Return 3 random test cases from the available ones
    const shuffled = [...testCases].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Calculate expected output based on pseudocode and inputs
 */
function calculateExpectedOutput(challenge, inputs) {
    try {
        const pseudocode = challenge.pseudocode;
        const vars = {};
        let inputIndex = 0;
        
        // Parse pseudocode line by line
        const lines = pseudocode.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            
            // INPUT statement
            if (trimmed.startsWith('INPUT ')) {
                const varName = trimmed.substring(6).trim();
                if (inputIndex < inputs.length) {
                    const value = inputs[inputIndex++];
                    const numValue = parseFloat(value);
                    vars[varName] = isNaN(numValue) ? value : numValue;
                }
            }
            // SET statement
            else if (trimmed.startsWith('SET ')) {
                const rest = trimmed.substring(4).trim();
                const [varName, expr] = rest.split('=').map(s => s.trim());
                if (expr) {
                    vars[varName] = evaluateExpression(expr, vars);
                }
            }
            // OUTPUT statement
            else if (trimmed.startsWith('OUTPUT ')) {
                const expr = trimmed.substring(7).trim();
                if (expr.startsWith('"') && expr.endsWith('"')) {
                    // String literal
                    return expr.slice(1, -1);
                } else {
                    // Expression
                    const result = evaluateExpression(expr, vars);
                    // Format numbers to 2 decimal places if needed
                    if (typeof result === 'number') {
                        // Check if challenge mentions decimal places
                        if (challenge.task.includes('two decimal places') || challenge.task.includes('2 decimal')) {
                            return result.toFixed(2);
                        }
                        // Check if result is whole number
                        if (result % 1 === 0) {
                            return result.toString();
                        }
                        return result.toFixed(2);
                    }
                    return result.toString();
                }
            }
        }
        
        return null;
    } catch (e) {
        console.error('Error calculating expected output:', e);
        return null;
    }
}

/**
 * Evaluate a simple expression with variables
 */
function evaluateExpression(expr, vars) {
    // Replace variable names with their values
    let result = expr;
    for (const [varName, value] of Object.entries(vars)) {
        const regex = new RegExp(`\\b${varName}\\b`, 'g');
        result = result.replace(regex, typeof value === 'string' ? `"${value}"` : value);
    }
    
    // Handle string concatenation
    if (result.includes('+') && result.includes('"')) {
        // String concatenation
        const parts = result.split('+').map(p => p.trim());
        return parts.map(p => {
            if (p.startsWith('"') && p.endsWith('"')) {
                return p.slice(1, -1);
            } else {
                return vars[p] || p;
            }
        }).join('');
    }
    
    // Evaluate numeric expression
    try {
        // Use Function constructor for safe evaluation
        return Function('"use strict"; return (' + result + ')')();
    } catch (e) {
        // Fallback: try direct evaluation
        try {
            return eval(result);
        } catch (e2) {
            console.error('Expression evaluation error:', e2);
            return null;
        }
    }
}

/**
 * Submit challenge solution for testing
 */
async function submitChallengeSolution(challengeId) {
    const challenge = FLOWCODE_CHALLENGES.find(ch => ch.id === challengeId);
    if (!challenge) return;
    
    // Get user's flowchart code
    if (!window.App || !window.App.nodes || !window.App.connections) {
        alert('Please create a flowchart first!');
        return;
    }
    
    // Generate test cases
    const testCases = generateTestCases(challenge, 3);
    if (!testCases || testCases.length === 0) {
        alert('Unable to generate test cases for this challenge.');
        return;
    }
    
    // Compile user's flowchart
    let userCode;
    try {
        // Wait a moment to ensure compiler is loaded (compiler.js loads after challenges.js)
        if (!window.compileWithPipeline) {
            // Wait up to 1 second for compiler to be available
            for (let i = 0; i < 10; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                if (window.compileWithPipeline) break;
            }
            if (!window.compileWithPipeline) {
                alert('Compiler not ready. Please refresh the page.');
                return;
            }
        }
        
        if (!window.executeWithSkulpt) {
            alert('Test execution not available. Please refresh the page.');
            return;
        }
        
        userCode = window.compileWithPipeline(window.App.nodes, window.App.connections, false, false);
        if (!userCode || userCode.trim() === '') {
            alert('Your flowchart is empty. Please create a solution first!');
            return;
        }
    } catch (e) {
        if (e.message && e.message.includes('compileWithPipeline')) {
            alert('Compiler not ready. Please refresh the page.');
        } else {
            alert('Error compiling your flowchart: ' + e.message);
        }
        return;
    }
    
    // Show loading state
    const submitBtn = document.getElementById('btn-submit-challenge');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i>Testing...';
    }
    
    // Run tests
    const results = [];
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        
        // Convert inputs to appropriate types
        const testInputs = testCase.inputs.map(input => {
            const num = parseFloat(input);
            return isNaN(num) ? input : num.toString();
        });
        
        // Small delay between tests to avoid Skulpt state issues
        if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Additional delay to ensure Skulpt is ready
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Execute user code
        let result;
        try {
            if (!window.executeWithSkulpt) {
                throw new Error('executeWithSkulpt not available');
            }
            
            // Ensure Skulpt is available
            if (typeof Sk === 'undefined' || !Sk || !Sk.configure) {
                throw new Error('Skulpt not loaded');
            }
            
            result = await window.executeWithSkulpt(userCode, testInputs, 3000);
            
            // Check if result is valid
            if (!result || typeof result !== 'object') {
                throw new Error('Execution returned invalid result');
            }
            
            // Ensure output property exists
            if (result.output === undefined) {
                result.output = '';
            }
        } catch (e) {
            console.error('Test execution error:', e);
            results.push({
                testNumber: i + 1,
                inputs: testCase.inputs,
                expected: testCase.expectedOutput.toString().trim(),
                actual: '(execution error)',
                passed: false,
                error: e.message || 'Execution failed'
            });
            continue;
        }
        
        // Clean output - preserve newlines for multi-line outputs
        let actualOutput = (result.output || '').trim();
        let expectedOutput = testCase.expectedOutput.toString().trim();
        
        // Normalize whitespace but preserve newlines
        actualOutput = actualOutput.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        expectedOutput = expectedOutput.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // Handle numeric comparison with tolerance
        let passed = false;
        if (actualOutput === expectedOutput) {
            passed = true;
        } else {
            // Try numeric comparison
            const actualNum = parseFloat(actualOutput);
            const expectedNum = parseFloat(expectedOutput);
            if (!isNaN(actualNum) && !isNaN(expectedNum)) {
                passed = Math.abs(actualNum - expectedNum) < 0.01;
            }
        }
        
        results.push({
            testNumber: i + 1,
            inputs: testCase.inputs,
            expected: expectedOutput,
            actual: actualOutput || '(no output)',
            passed: passed,
            error: result.error || null
        });
    }
    
    // Display results
    displayTestResults(results);
    
    // Check if all tests passed
    const allPassed = results.every(r => r.passed);
    if (allPassed) {
        // Automatically mark as complete
        if (!CHALLENGE_COMPLETED.has(challengeId)) {
            CHALLENGE_COMPLETED.add(challengeId);
            saveCompletedChallenges(CHALLENGE_COMPLETED);
            updateActiveChallengeCompleteButton(challengeId);
            renderChallengeList();
        }
    }
    
    // Reset button
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-1"></i>Submit Solution';
    }
}

/**
 * Display test results in the UI
 */
function displayTestResults(results) {
    const resultsContainer = document.getElementById('active-challenge-test-results');
    const resultsList = document.getElementById('test-results-list');
    
    if (!resultsContainer || !resultsList) return;
    
    // Switch to test tab
    const testTab = document.getElementById('test-tab');
    const pseudocodeTab = document.getElementById('pseudocode-tab');
    if (testTab && pseudocodeTab) {
        testTab.classList.add('active');
        pseudocodeTab.classList.remove('active');
        document.getElementById('test-pane').classList.add('show', 'active');
        document.getElementById('pseudocode-pane').classList.remove('show', 'active');
    }
    
    resultsContainer.style.display = 'block';
    resultsList.innerHTML = '';
    
    results.forEach(result => {
        const testDiv = document.createElement('div');
        testDiv.className = `mb-2 p-2 border rounded ${result.passed ? 'bg-success bg-opacity-10 border-success' : 'bg-danger bg-opacity-10 border-danger'}`;
        
        const icon = result.passed ? 
            '<i class="fa-solid fa-check-circle text-success me-2"></i>' : 
            '<i class="fa-solid fa-times-circle text-danger me-2"></i>';
        
        const status = result.passed ? '<span class="text-success fw-bold">PASSED</span>' : '<span class="text-danger fw-bold">FAILED</span>';
        
        testDiv.innerHTML = `
            <div class="d-flex align-items-center mb-1">
                ${icon}
                <strong>Test ${result.testNumber}:</strong> ${status}
            </div>
            <div class="small">
                <div><strong>Input:</strong> ${result.inputs.join(', ')}</div>
                <div><strong>Expected:</strong> <code>${result.expected}</code></div>
                <div><strong>Got:</strong> <code>${result.actual || '(no output)'}</code></div>
                ${result.error ? `<div class="text-danger"><strong>Error:</strong> ${result.error}</div>` : ''}
            </div>
        `;
        
        resultsList.appendChild(testDiv);
    });
}

});





