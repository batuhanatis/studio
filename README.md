# Firebase Studio Movie Finder

This is a NextJS starter app in Firebase Studio for finding movies.

---

## How to Fix Firestore Permission Errors

If you see a "Missing or insufficient permissions" error or a "Could not sync your profile" error in the app, it means your database security rules are not set up correctly in the Firebase Console.

Follow these steps exactly to fix it:

### Step 1: Go to Your Firebase Project

- Open the [Firebase Console](https://console.firebase.google.com/).
- Select your project: **watchme-b8338**.

### Step 2: Navigate to Firestore Rules

- In the left-hand menu, click on **Build** and then select **Firestore Database**.
- Click on the **Rules** tab at the top of the page.

![Firestore Rules Tab](https://storage.googleapis.com/firebase-studio-public/tutorial-screenshots/firestore-rules-1.png)

### Step 3: Replace the Rules

- **Delete all the text** that is currently in the rules editor.
- Open the `firestore.rules` file from the file explorer on the left side of this IDE.
- Copy the **entire contents** of the `firestore.rules` file.
- Paste the copied rules into the editor in the Firebase Console.

### Step 4: Publish Your Changes

- Click the **Publish** button at the top of the rules editor.

![Publish Firestore Rules](https://storage.googleapis.com/firebase-studio-public/tutorial-screenshots/firestore-rules-2.png)

- It may take a minute for the changes to take effect.
- **Refresh the application page.** The permission errors should now be gone.
