# DocuMind

**"Your documents, understood and organised."**

DocuMind is a full-stack personal document management SaaS built with Next.js 16, TypeScript, Tailwind CSS v4, and SQLite (`node:sqlite`). It lets users securely upload, organise, preview, track, and query warranties, insurance policies, gift cards, vouchers, invoices, receipts, and agreements.

## Features

- **Authentication & User Vaults**: Salted `scrypt` password hashing, HMAC-signed HTTP-only sessions backed by SQLite, profile management, password updates, and per-user data isolation.
- **Document Management**: Drag-and-drop PDF and image uploads (`PDF`, `PNG`, `JPG`, `WEBP`), manual entries, inline file previews, original downloads, editing, deletion with confirmation, search, multi-filter, sorting, and custom tags.
- **Intelligent Document Processing**: Server-side PDF text extraction (`unpdf`) and offline image OCR (`tesseract.js` + `@tesseract.js-data/eng`) to detect categories, issuers, purchase/expiry dates, warranty durations, policy/reference numbers, and amounts.
- **AI Assistant**: Persistent document conversations grounded in stored records and extracted text with clickable document citations, plus optional encrypted OpenAI or Google Gemini API key support in Settings.
- **Expiry Calendar & Reminders**: Monthly expiry calendar, `.ics` calendar export, automatic expiry reminders based on configurable lead times, custom reminders, snooze/complete workflows, and in-app notification centre.
- **Responsive Design**: Collapsible desktop sidebar, tablet/mobile slide-over navigation drawer, `Ctrl+K` global search, and responsive layouts across laptop, tablet, and phone viewports.

## Running Locally

```bash
npm install
npm run build
npm run start
```

Or run in development mode:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Local SQLite data (`data/documind.db`) and uploaded files (`data/uploads/`) are created automatically and ignored by git.
