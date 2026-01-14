"use client"

import { useSyncExternalStore } from "react"

export type Locale = "en" | "de"

const LOCALE_STORAGE_KEY = "source-manager-locale"

const translations = {
  en: {
    appName: "Source Manager",
    nav: {
      projects: "Projects",
      sources: "Sources",
      citations: "Citations",
      settings: "Settings",
      accountSettings: "Account Settings",
      logIn: "Log In",
      signIn: "Sign In",
      logOut: "Log Out",
    },
    home: {
      title: "Your Projects",
      createProject: "Create New Project",
      noProjects: "You don't have any projects yet. Create your first project to get started!",
      loginPrompt: "Please log in to view your projects.",
      projectCount: "project",
      projectCountPlural: "projects",
      created: "Created",
      lastEdited: "Last edited",
      delete: "Delete",
      deleteProject: "Delete Project",
      deleteConfirm: "Are you sure you want to delete this project? This action cannot be undone and will delete all associated sources, citations, and topics.",
      cancel: "Cancel",
      deleting: "Deleting...",
      projectCreated: "Project created successfully",
      projectDeleted: "Project deleted successfully",
      createDialogTitle: "Create New Project",
      createDialogDescription: "Create a new project to organize your sources and citations.",
      projectTitle: "Title",
      projectDescription: "Description",
      projectTitlePlaceholder: "My Research Project",
      projectDescriptionPlaceholder: "A brief description of your project...",
      creating: "Creating...",
      createCard: "Create a new project",
    },
    login: {
      title: "Login",
      email: "Email",
      password: "Password",
      emailPlaceholder: "name@example.com",
      submit: "Sign In",
      switchToSignup: "Don't have an account? Sign up",
    },
    signup: {
      title: "Sign Up",
      email: "Email",
      password: "Password",
      name: "Name",
      namePlaceholder: "John Doe",
      emailPlaceholder: "name@example.com",
      submit: "Create Account",
      switchToLogin: "Already have an account? Sign in",
    },
    oauth: {
      continueWith: "Continue with",
      github: "GitHub",
      microsoft: "Microsoft",
      atlassian: "Atlassian",
      additionalMethods: "Additional login methods can be added later",
    },
    errors: {
      required: "This field is required",
      emailInvalid: "Please enter a valid email address",
      passwordMinLength: "Password must be at least 8 characters",
      generic: "An error occurred. Please try again.",
      invalidCredentials: "Invalid email or password",
    },
    sources: {
      title: "Sources",
      manageSources: "Manage your sources",
      noSources: "No sources yet. Add your first source to get started!",
      addSource: "Add Source",
      editSource: "Edit Source",
      deleteSource: "Delete Source",
      deleteConfirm: "Are you sure you want to delete this source? This action cannot be undone.",
      deleting: "Deleting...",
      sourceCreated: "Source created successfully",
      sourceUpdated: "Source updated successfully",
      sourceDeleted: "Source deleted successfully",
      copyBibtex: "Copy BibTeX",
      bibtexCopied: "BibTeX copied to clipboard",
      addCitation: "Add Citation",
      columns: {
        abbreviation: "Abbreviation",
        title: "Title",
        authors: "Authors",
        publicationDate: "Publication Date",
        topics: "Topics",
        description: "Description",
        notes: "Notes",
        links: "Links",
        bibtex: "BibTeX",
      },
      filters: {
        topic: "Topic",
        yearFrom: "Year From",
        yearTo: "Year To",
        author: "Author",
        all: "All",
      },
      sorting: {
        asc: "Ascending",
        desc: "Descending",
        none: "None",
      },
      pagination: {
        perPage: "per page",
        showing: "Showing",
        of: "of",
        results: "results",
      },
      search: {
        placeholder: "Search sources...",
      },
      addDialog: {
        title: "Add New Source",
        description: "Create a new source. You can either fill in the fields manually or paste BibTeX to auto-fill.",
        abbreviation: "Abbreviation",
        abbreviationPlaceholder: "e.g., Smith2023",
        titleLabel: "Title",
        titlePlaceholder: "Source title",
        authors: "Authors",
        authorsPlaceholder: "Last, First; Last, First (separated by semicolon)",
        publicationDate: "Publication Date",
        publicationDatePlaceholder: "YYYY or YYYY-MM or YYYY-MM-DD",
        descriptionLabel: "Description",
        descriptionPlaceholder: "Source description",
        notes: "Notes",
        notesPlaceholder: "Additional notes",
        links: "Links",
        linksPlaceholder: "URLs (comma-separated)",
        bibtex: "BibTeX",
        bibtexPlaceholder: "@article{key,\n  title = \"Title\",\n  author = \"Author\",\n  year = \"2023\"\n}",
        topics: "Topics",
        createTopic: "Create New Topic",
        topicName: "Topic Name",
        topicAbbreviation: "Abbreviation",
        topicColor: "Color",
        creating: "Creating...",
        create: "Create",
      },
      columnSettings: {
        title: "Column Settings",
        showHide: "Show/Hide Columns",
        reorder: "Drag to reorder columns",
      },
      export: {
        download: "Download",
        downloadAs: "Download as",
        csv: "CSV",
        json: "JSON",
      },
      import: {
        import: "Import",
        importSources: "Import Sources",
        selectFile: "Select File",
        fileSelected: "File selected",
        preview: "Preview",
        importSelected: "Import Selected",
        cancel: "Cancel",
        excludeExisting: "Exclude Existing BibTeX",
        noSourcesToImport: "No sources to import",
        sourcesToImport: "sources to import",
        importing: "Importing...",
        importSuccess: "Sources imported successfully",
        importError: "Failed to import sources",
        invalidFile: "Invalid file format",
        selectAll: "Select All",
        deselectAll: "Deselect All",
      },
    },
  },
  de: {
    appName: "Source Manager",
    nav: {
      projects: "Projekte",
      sources: "Quellen",
      citations: "Zitate",
      settings: "Einstellungen",
      accountSettings: "Kontoeinstellungen",
      logIn: "Anmelden",
      signIn: "Registrieren",
      logOut: "Abmelden",
    },
    home: {
      title: "Deine Projekte",
      createProject: "Neues Projekt erstellen",
      noProjects: "Du hast noch keine Projekte. Erstelle dein erstes Projekt, um zu beginnen!",
      loginPrompt: "Bitte melde dich an, um deine Projekte anzuzeigen.",
      projectCount: "Projekt",
      projectCountPlural: "Projekte",
      created: "Erstellt",
      lastEdited: "Zuletzt bearbeitet",
      delete: "Löschen",
      deleteProject: "Projekt löschen",
      deleteConfirm: "Bist du sicher, dass du dieses Projekt löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden und löscht alle zugehörigen Quellen, Zitate und Themen.",
      cancel: "Abbrechen",
      deleting: "Wird gelöscht...",
      projectCreated: "Projekt erfolgreich erstellt",
      projectDeleted: "Projekt erfolgreich gelöscht",
      createDialogTitle: "Neues Projekt erstellen",
      createDialogDescription: "Erstelle ein neues Projekt, um deine Quellen und Zitate zu organisieren.",
      projectTitle: "Titel",
      projectDescription: "Beschreibung",
      projectTitlePlaceholder: "Mein Forschungsprojekt",
      projectDescriptionPlaceholder: "Eine kurze Beschreibung deines Projekts...",
      creating: "Wird erstellt...",
      createCard: "Neues Projekt erstellen",
    },
    login: {
      title: "Anmelden",
      email: "E-Mail",
      password: "Passwort",
      emailPlaceholder: "name@beispiel.de",
      submit: "Anmelden",
      switchToSignup: "Noch kein Konto? Registrieren",
    },
    signup: {
      title: "Registrieren",
      email: "E-Mail",
      password: "Passwort",
      name: "Name",
      namePlaceholder: "Max Mustermann",
      emailPlaceholder: "name@beispiel.de",
      submit: "Konto erstellen",
      switchToLogin: "Bereits ein Konto? Anmelden",
    },
    oauth: {
      continueWith: "Weiter mit",
      github: "GitHub",
      microsoft: "Microsoft",
      atlassian: "Atlassian",
      additionalMethods: "Zusätzliche Anmeldemethoden können später hinzugefügt werden",
    },
    errors: {
      required: "Dieses Feld ist erforderlich",
      emailInvalid: "Bitte gib eine gültige E-Mail-Adresse ein",
      passwordMinLength: "Das Passwort muss mindestens 8 Zeichen lang sein",
      generic: "Ein Fehler ist aufgetreten. Bitte versuche es erneut.",
      invalidCredentials: "Ungültige E-Mail oder Passwort",
    },
    sources: {
      title: "Quellen",
      manageSources: "Verwalte deine Quellen",
      noSources: "Noch keine Quellen. Füge deine erste Quelle hinzu, um zu beginnen!",
      addSource: "Quelle hinzufügen",
      editSource: "Quelle bearbeiten",
      deleteSource: "Quelle löschen",
      deleteConfirm: "Bist du sicher, dass du diese Quelle löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.",
      deleting: "Wird gelöscht...",
      sourceCreated: "Quelle erfolgreich erstellt",
      sourceUpdated: "Quelle erfolgreich aktualisiert",
      sourceDeleted: "Quelle erfolgreich gelöscht",
      copyBibtex: "BibTeX kopieren",
      bibtexCopied: "BibTeX in Zwischenablage kopiert",
      addCitation: "Zitat hinzufügen",
      columns: {
        abbreviation: "Abkürzung",
        title: "Titel",
        authors: "Autoren",
        publicationDate: "Veröffentlichungsdatum",
        topics: "Themen",
        description: "Beschreibung",
        notes: "Notizen",
        links: "Links",
        bibtex: "BibTeX",
      },
      filters: {
        topic: "Thema",
        yearFrom: "Jahr Von",
        yearTo: "Jahr Bis",
        author: "Autor",
        all: "Alle",
      },
      sorting: {
        asc: "Aufsteigend",
        desc: "Absteigend",
        none: "Keine",
      },
      pagination: {
        perPage: "pro Seite",
        showing: "Zeige",
        of: "von",
        results: "Ergebnisse",
      },
      search: {
        placeholder: "Quellen durchsuchen...",
      },
      addDialog: {
        title: "Neue Quelle hinzufügen",
        description: "Erstelle eine neue Quelle. Du kannst entweder die Felder manuell ausfüllen oder BibTeX einfügen, um automatisch auszufüllen.",
        abbreviation: "Abkürzung",
        abbreviationPlaceholder: "z.B., Smith2023",
        titleLabel: "Titel",
        titlePlaceholder: "Quellentitel",
        authors: "Autoren",
        authorsPlaceholder: "Nachname, Vorname; Nachname, Vorname (durch Semikolon getrennt)",
        publicationDate: "Veröffentlichungsdatum",
        publicationDatePlaceholder: "JJJJ oder JJJJ-MM oder JJJJ-MM-TT",
        descriptionLabel: "Beschreibung",
        descriptionPlaceholder: "Quellenbeschreibung",
        notes: "Notizen",
        notesPlaceholder: "Zusätzliche Notizen",
        links: "Links",
        linksPlaceholder: "URLs (kommagetrennt)",
        bibtex: "BibTeX",
        bibtexPlaceholder: "@article{key,\n  title = \"Titel\",\n  author = \"Autor\",\n  year = \"2023\"\n}",
        topics: "Themen",
        createTopic: "Neues Thema erstellen",
        topicName: "Themenname",
        topicAbbreviation: "Abkürzung",
        topicColor: "Farbe",
        creating: "Wird erstellt...",
        create: "Erstellen",
      },
      columnSettings: {
        title: "Spalteneinstellungen",
        showHide: "Spalten ein-/ausblenden",
        reorder: "Ziehen, um Spalten neu anzuordnen",
      },
      export: {
        download: "Herunterladen",
        downloadAs: "Herunterladen als",
        csv: "CSV",
        json: "JSON",
      },
      import: {
        import: "Importieren",
        importSources: "Quellen importieren",
        selectFile: "Datei auswählen",
        fileSelected: "Datei ausgewählt",
        preview: "Vorschau",
        importSelected: "Ausgewählte importieren",
        cancel: "Abbrechen",
        excludeExisting: "Vorhandene BibTeX ausschließen",
        noSourcesToImport: "Keine Quellen zum Importieren",
        sourcesToImport: "Quellen zum Importieren",
        importing: "Wird importiert...",
        importSuccess: "Quellen erfolgreich importiert",
        importError: "Fehler beim Importieren der Quellen",
        invalidFile: "Ungültiges Dateiformat",
        selectAll: "Alle auswählen",
        deselectAll: "Alle abwählen",
      },
    },
  },
} as const

function getStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null
  
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
  if (stored === "en" || stored === "de") {
    return stored
  }
  
  return null
}

function getBrowserLocale(): Locale {
  if (typeof window === "undefined") return "en"
  
  const browserLang = navigator.language || ((navigator as Navigator & { userLanguage?: string }).userLanguage) || "en"
  return browserLang.startsWith("de") ? "de" : "en"
}

function getServerSnapshot(): Locale {
  return "en"
}

// Store for locale changes within the same window
let localeStore: Locale = "en"
const listeners = new Set<() => void>()

function subscribe(callback: () => void) {
  listeners.add(callback)
  // Also listen to storage events from other tabs
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorageChange)
  }
  return () => {
    listeners.delete(callback)
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorageChange)
    }
  }
}

function handleStorageChange(e: StorageEvent) {
  if (e.key === LOCALE_STORAGE_KEY && e.newValue) {
    if (e.newValue === "en" || e.newValue === "de") {
      localeStore = e.newValue
      listeners.forEach((listener) => listener())
    }
  }
}

function getSnapshot(): Locale {
  if (typeof window === "undefined") {
    return localeStore
  }
  const stored = getStoredLocale()
  if (stored) {
    localeStore = stored
    return stored
  }
  const browserLocale = getBrowserLocale()
  localeStore = browserLocale
  return browserLocale
}

export function useTranslations() {
  // Use useSyncExternalStore to properly sync with localStorage
  // This ensures server and client render the same initial value ("en")
  // and then updates after hydration
  const locale = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  const changeLocale = (newLocale: Locale) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale)
      localeStore = newLocale
      // Notify all listeners
      listeners.forEach((listener) => listener())
    }
  }

  return { t: translations[locale], locale, setLocale: changeLocale }
}

export type Translations = typeof translations.en

