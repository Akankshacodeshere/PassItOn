# PassItOn setup guide (for beginners)

Order: **Part 1** try it · **Part 2** Supabase (the database and login) · **Part 3** connect and test on your laptop · **Part 4** Git and GitHub · **Part 5** put it online · **Part 6** later changes · **Part 7** problems.

## Part 1. Try it right now (no setup)
Unzip the folder and double-click `index.html`. While `config.js` still has the placeholders, the site works as a **prototype** on your own computer: nothing is sent anywhere and data stays in your browser.
Log in with any `@bennett.edu.in` email (the code appears in an email-style card on screen). Log in as `admin@bennett.edu.in` to see the moderator "Review queue". Browsing works without logging in; logging in is needed to sell, contact sellers, report and review.

## Part 2. Supabase (free) = our database, login and photo storage
1. Go to supabase.com, click **Start your project**, sign in with GitHub.
2. **New project**: name `passiton`, choose a database password (save it somewhere), region **Mumbai** if available. Wait 1 to 2 minutes.
3. Left menu **SQL Editor** > **New query**. Open `schema.sql` from the folder, copy everything, paste it, press **Run**. It should say "Success". This creates the tables, the approval rules and the photo storage.
   - Different college domain? Before running, replace `bennett.edu.in` (3 places) in `schema.sql`.
4. Left menu **Authentication** > **Email Templates** (newer dashboards: Authentication > Emails > Templates). Open **Confirm signup** and **Magic Link**. In each one add a line: `Your PassItOn code: {{ .Token }}` then Save. (This makes the email contain a 6-digit code.)
5. **Project Settings** (gear icon) > **API**. Copy the **Project URL** and the public key (called **anon public**, or **publishable**). Never copy the `service_role` / secret key.
6. **Make moderators.** SQL Editor > New query, run one line per moderator (use their real college email):
   `insert into moderators (email) values ('name@bennett.edu.in');`
   Pick 3 people so approvals are quick. They just log in normally and a "Review queue" tab appears.

## Part 3. Connect the site and test on your laptop
1. Open `config.js` in VS Code (or Notepad). Replace `YOUR-PROJECT...` with the Project URL and `YOUR-ANON-PUBLIC-KEY` with the key. Keep the quote marks. Set `ADMIN` to your email. Save.
2. Run it as a small local website (login links need this): open a terminal in the folder and type
   `python3 -m http.server 8000` (Windows: `python -m http.server 8000`), then open http://localhost:8000
   No Python? In VS Code install the **Live Server** extension and click "Go Live".
3. Test: log in with your college email, check your inbox for the code, post an item, then log in as a moderator and approve it.

## Part 4. Git and GitHub
**What are they?** Git saves versions of your files on your computer. GitHub is a website that stores that Git history online and can host your site for free.

**One-time setup**
1. Install Git: git-scm.com/downloads (keep default options). Check by typing `git --version` in a terminal.
2. Install VS Code (code.visualstudio.com). It has a built-in terminal: menu **Terminal > New Terminal**.
3. Create a GitHub account at github.com.
4. Tell Git who you are (use the same email as GitHub):
   ```
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```

**Create the repository (the online folder)**
5. On github.com click **+** (top right) > **New repository**. Name: `passiton`. Choose **Public**. **Do not** tick "Add a README", ".gitignore" or "license" (we already have them). Click **Create repository**. Keep the page open, it shows the repo address.

**Send your files up** (run these in the terminal, inside the `passiton` folder; check with `pwd`/`cd`)
6. `git init` creates a hidden Git history in this folder.
7. `git add .` marks all files to be saved (the dot means "everything here").
8. `git commit -m "PassItOn first version"` saves a snapshot with a message.
9. `git branch -M main` names the main line of history "main".
10. `git remote add origin https://github.com/YOUR-USERNAME/passiton.git` links your folder to the online repo (copy the exact address from GitHub).
11. `git push -u origin main` uploads everything. A browser window may open asking you to sign in to GitHub: do that. (GitHub no longer accepts your account password in the terminal. If it asks for a password, create a **Personal access token**: GitHub > Settings > Developer settings > Personal access tokens, tick `repo`, and paste that as the password.)
12. Refresh your GitHub repo page: your files are there.

## Part 5. Put the site online (GitHub Pages)
1. In your repo: **Settings** > **Pages** (left menu).
2. Under **Build and deployment**: Source = **Deploy from a branch**. Branch = **main**, folder = **/ (root)**. Click **Save**.
3. Wait 1 to 2 minutes and refresh. The address appears at the top: `https://YOUR-USERNAME.github.io/passiton/`
4. **Important:** go back to Supabase > **Authentication** > **URL Configuration**. Set **Site URL** to that address and add it under **Redirect URLs**. (Without this, links in login emails point to the wrong place.)
5. Open your live address and run the test list below.

**Test list**
- A gmail address is refused at login.
- A new post shows "Waiting for approval" in My listings and is NOT on Browse.
- A moderator approves it and it appears on Browse. Rejecting shows the reason to the seller.
- Contact seller, Save, Mark as sold, Report all work. Try it on a phone too.

**Several teammates working together:** repo **Settings > Collaborators > Add people**, add their GitHub usernames. They then run `git clone https://github.com/YOUR-USERNAME/passiton.git`.

## Part 6. Changing something later
Edit the files, then in the terminal:
```
git add .
git commit -m "describe what you changed"
git push
```
The live site updates in about a minute.

## Part 7. Common problems
| Problem | Fix |
|---|---|
| `fatal: not a git repository` | You are in the wrong folder. `cd` into the `passiton` folder. |
| `remote origin already exists` | `git remote set-url origin https://github.com/YOUR-USERNAME/passiton.git` |
| Push is rejected | You added a README when creating the repo. Easiest: delete the repo on GitHub and create it again empty. |
| Pages shows 404 | Check Settings > Pages is set to `main` / root, and `index.html` is in the top folder of the repo. Wait 2 minutes. |
| No login email arrives | Check spam. Supabase's free email allows only a few emails an hour: wait, or add free custom SMTP (Brevo or Resend) in Authentication > SMTP Settings. |
| Email has a link but no code | You skipped step 4 of Part 2 (the `{{ .Token }}` line). |
| Login link opens localhost | Part 5 step 4 (Site URL) is not set. |
| Login code shows on screen instead of arriving by email | `config.js` still has the placeholders (prototype mode), or you didn't save/push it. |
| "new row violates row-level security" | `schema.sql` wasn't fully run, or the email doesn't end with your college domain. |
| Nobody sees a Review queue | Their email isn't in the `moderators` table (Part 2 step 6). |

Never put the `service_role` key anywhere in the files. The key in `config.js` is meant to be public.
