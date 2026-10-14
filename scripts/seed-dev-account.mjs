#!/usr/bin/env node
/**
 * Make sure the dev stack has a ready-to-use test account.
 *
 * Signs in as DEV_TEST_EMAIL / DEV_TEST_PASSWORD, registering the account
 * first if it doesn't exist. If the account has no tasks, adds a small set of
 * sample tasks, subtasks and an idea board so every screen has something on
 * it. Safe to run on every start: an account that already has tasks is left
 * alone.
 *
 * Run by the `dev-planner-seed` service in docker-compose.dev.yml.
 */

const api = (process.env.API_URL ?? "http://dev-planner-api:3001").replace(/\/$/, "");
const email = process.env.DEV_TEST_EMAIL;
const password = process.env.DEV_TEST_PASSWORD;

if (!email || !password) {
  console.error("[seed] Set DEV_TEST_EMAIL and DEV_TEST_PASSWORD (see .env.dev).");
  process.exit(1);
}

async function call(method, path, body, token) {
  const res = await fetch(`${api}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token && { authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function must(method, path, body, token) {
  const { status, json } = await call(method, path, body, token);
  if (status >= 400) {
    throw new Error(`${method} ${path} → ${status} ${JSON.stringify(json.error ?? json)}`);
  }
  return json.data;
}

function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function signIn() {
  const login = await call("POST", "/auth/login", { email, password });
  if (login.status === 200) return { token: login.json.data.token, created: false };
  const reg = await call("POST", "/auth/register", { email, password, name: "Dev Tester" });
  if (reg.status === 201) return { token: reg.json.data.token, created: true };
  throw new Error(
    `Couldn't sign in or register ${email}: login ${login.status}, register ${reg.status} ${JSON.stringify(reg.json.error ?? reg.json)}`
  );
}

async function seed(token) {
  const task = (body) => must("POST", "/tasks", body, token);
  const subtask = (taskId, title) =>
    must("POST", `/tasks/${taskId}/subtasks`, { title }, token);

  const home = await must("POST", "/projects", {
    name: "Home renovation",
    color: "#F59E0B",
    icon: "Home",
    description: "Kitchen and hallway, done before the holidays.",
    targetDate: day(45),
  }, token);
  const launch = await must("POST", "/projects", {
    name: "Side project launch",
    color: "#22C55E",
    icon: "Rocket",
  }, token);
  const errand = await must("POST", "/tags", { name: "errand", color: "#F59E0B" }, token);
  const deep = await must("POST", "/tags", { name: "deep-work", color: "#A855F7" }, token);
  await must("POST", "/tags", { name: "waiting", color: "#6B7280" }, token);
  await task({ title: "Get three quotes for the kitchen", scheduledDate: day(0), priority: "P1", projectId: home.id, tagIds: [errand.id] });
  await task({ title: "Pick hallway paint", scheduledDate: day(2), projectId: home.id });
  await task({ title: "Order worktop samples", projectId: home.id });
  const landing = await task({ title: "Set up a landing page", priority: "P1", scheduledDate: day(0), dueDate: day(2), estimatedMins: 180, projectId: launch.id });
  const post = await task({ title: "Write the launch post", scheduledDate: day(1), dueDate: day(3), estimatedMins: 90, projectId: launch.id, tagIds: [deep.id] });
  const beta = await task({ title: "Invite beta testers", scheduledDate: day(3), dueDate: day(5), estimatedMins: 60, projectId: launch.id });
  const launchDay = await task({ title: "Launch", dueDate: day(7), estimatedMins: 30, projectId: launch.id });
  const blocks = (blocked, blocker) =>
    must("POST", `/tasks/${blocked.id}/dependencies`, { blockerTaskId: blocker.id }, token);
  await blocks(post, landing);
  await blocks(beta, landing);
  await blocks(launchDay, post);
  await blocks(launchDay, beta);

  const review = await task({
    title: "Review the backup export",
    scheduledDate: day(0),
    priority: "P1",
    estimatedMins: 30,
    notes: "Settings → Backup → Export, then open the file.",
  });
  await subtask(review.id, "Export a backup");
  await subtask(review.id, "Check the task count matches");
  await task({ title: "Write weekly notes", scheduledDate: day(0), priority: "P2", estimatedMins: 20 });
  const done = await task({ title: "Morning inbox sweep", scheduledDate: day(0), priority: "P3", estimatedMins: 15 });
  await must("POST", `/tasks/${done.id}/complete`, {}, token);
  await task({ title: "Plan the projects structure", scheduledDate: day(1), priority: "P0", estimatedMins: 60 });
  await task({ title: "Restore a backup into this account", priority: "P2" });
  await task({ title: "Tidy the backlog", priority: "P3" });
  await must("POST", "/ideas/boards", { name: "Someday" }, token);
}

const deadline = Date.now() + 120_000;
for (;;) {
  try {
    const health = await fetch(`${api}/health`);
    if (health.ok) break;
  } catch {
    // API not up yet
  }
  if (Date.now() > deadline) {
    console.error(`[seed] ${api} didn't become healthy in time`);
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 2000));
}

try {
  const { token, created } = await signIn();
  const tasks = await must("GET", "/tasks?limit=1", undefined, token);
  if (tasks.length === 0) {
    await seed(token);
    console.log(`[seed] ${created ? "Created" : "Refilled"} ${email} with sample data.`);
  } else {
    console.log(`[seed] ${email} is ready (existing data kept).`);
  }
} catch (error) {
  console.error(`[seed] ${error.message}`);
  process.exit(1);
}
