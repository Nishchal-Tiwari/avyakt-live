/**
 * Test script to automate multiple browsers joining the livekit meeting.
 * Built using Puppeteer to allow multiple isolated browser sessions.
 */
const puppeteer = require('puppeteer');

const DEMO_PASSWORD = "demo123";
const TEACHER_EMAIL = "teacher@yoga.demo";
const STUDENTS = [
  "student@yoga.demo",
  "student1@yoga.demo",
  "student2@yoga.demo",
  "student3@yoga.demo",
  "student4@yoga.demo",
  "student5@yoga.demo",
  "student6@yoga.demo"
];

const PLATFORM_URL = process.env.PLATFORM_URL || "http://localhost:5173";

async function loginAndJoin(browser, email, password, role) {
  // Create an incognito browser context for an isolated session (cookies/localStorage isolated)
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  
  // Set window size
  await page.setViewport({ width: 1000, height: 800 });

  console.log(`[${role}] Navigating to login: ${email}`);
  await page.goto(`${PLATFORM_URL}/login`, { waitUntil: 'networkidle0' });
  
  await page.type('#email', email);
  await page.type('#password', password);
  
  // Wait for navigation after clicking submit
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('button[type="submit"]')
  ]);
  
  console.log(`[${role}] Logged in successfully: ${email}`);
  
  // Wait for the classes dashboard to load and for the joining button to appear
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('button')).some(el => el.textContent.toLowerCase().includes('meeting'));
  }, { timeout: 10000 });
  
  // Find the button and click it to join the class
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const joinBtn = buttons.find(el => el.textContent.toLowerCase().includes('meeting'));
    if (joinBtn) {
      joinBtn.click();
    }
  });

  console.log(`[${role}] Button clicked, joined meeting: ${email}`);
  return { context, page };
}

async function main() {
  console.log("Launching browser...");
  // Launch browser with fake UI for media stream to automatically allow camera and mic permissions
  const browser = await puppeteer.launch({
    headless: false, // Make it visible so you can test easily
    defaultViewport: null,
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream'
    ]
  });

  try {
    // 1. Let the teacher in first
    await loginAndJoin(browser, TEACHER_EMAIL, DEMO_PASSWORD, 'Teacher');
    
    // Wait a couple of seconds to ensure the room is initialized
    console.log("Waiting for the teacher's meeting to initialize...");
    await new Promise(r => setTimeout(r, 4000));
    
    // 2. Let the students join
    for (const student of STUDENTS) {
      // Add a slight delay between students joining
      await new Promise(r => setTimeout(r, 2000));
      loginAndJoin(browser, student, DEMO_PASSWORD, 'Student').catch(err => {
        console.error(`Error joining as ${student}:`, err);
      });
    }

    console.log(`\n===========================================`);
    console.log(`All participants initialized!`);
    console.log(`Keep the terminal running to keep browsers open.`);
    console.log(`Press Ctrl+C to stop.`);
    console.log(`===========================================\n`);
    
    // Keep script running until user closes manually so browsers don't close
    await new Promise(() => {});
  } catch (error) {
    console.error("Test script failed:", error);
    await browser.close();
  }
}

main().catch(console.error);