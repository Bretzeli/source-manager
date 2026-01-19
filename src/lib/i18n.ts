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
      deleteConfirm: "Are you sure you want to delete this project? This action cannot be undone and will delete all associated sources, citations, and tags.",
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
        tags: "Tags",
        description: "Description",
        notes: "Notes",
        links: "Links",
        bibtex: "BibTeX",
      },
      filters: {
        tag: "Tag",
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
        tags: "Tags",
        createTag: "Create New Tag",
        tagName: "Tag Name",
        tagAbbreviation: "Abbreviation",
        tagColor: "Color",
        creating: "Creating...",
        create: "Create",
      },
      columnSettings: {
        title: "Column Settings",
        showHide: "Show/Hide Columns",
        reorder: "Drag to reorder columns",
        keepTableWidth: "Keep table width",
        showColumnSeparators: "Show column separators",
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
      deleteConfirm: "Bist du sicher, dass du dieses Projekt löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden und löscht alle zugehörigen Quellen, Zitate und Tags.",
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
        tags: "Tags",
        description: "Beschreibung",
        notes: "Notizen",
        links: "Links",
        bibtex: "BibTeX",
      },
      filters: {
        tag: "Tag",
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
        tags: "Tags",
        createTag: "Neues Tag erstellen",
        tagName: "Tagname",
        tagAbbreviation: "Abkürzung",
        tagColor: "Farbe",
        creating: "Wird erstellt...",
        create: "Erstellen",
      },
      columnSettings: {
        title: "Spalteneinstellungen",
        showHide: "Spalten ein-/ausblenden",
        reorder: "Ziehen, um Spalten neu anzuordnen",
        keepTableWidth: "Tabellenbreite beibehalten",
        showColumnSeparators: "Spaltentrenner anzeigen",
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
    settings: {
      title: "Einstellungen",
      projectSettings: "Projekteinstellungen für",
      github: {
        title: "GitHub Repository",
        description: "Verknüpfe dein GitHub-Konto, um auf Repositorys zuzugreifen und Zitate in ausgewählten Dateien zu prüfen",
        accountRequired: "GitHub-Konto erforderlich",
        accountRequiredDescription: "Du hast dich mit GitHub angemeldet, aber du musst die GitHub App installieren und Repositorys auswählen, um darauf zuzugreifen.",
        accountRequiredDescriptionNotLinked: "Du musst dein GitHub-Konto verknüpfen, um auf Repositorys zuzugreifen. Falls du dich mit GitHub angemeldet hast, installiere bitte die GitHub App und wähle aus, welchen Repositorys Zugriff gewährt werden soll.",
        linkAccount: "GitHub-Konto verknüpfen",
        linkGitHub: "GitHub verknüpfen",
        connecting: "Wird verbunden...",
        syncExistingInstallation: "Bestehende Installation synchronisieren",
        accountLinked: "GitHub-Konto verknüpft",
        accountNotLinked: "GitHub-Konto nicht verknüpft",
        linkAccountToAccess: "Verknüpfe dein GitHub-Konto, um auf Repositorys zuzugreifen",
        accessGranted: "Zugriff auf {count} Repository(s) gewährt",
        accessGrantedOne: "Zugriff auf 1 Repository gewährt",
        loadingRepos: "Repositorys werden geladen...",
        disconnect: "Trennen",
        disconnecting: "Wird getrennt...",
        selectAccount: "GitHub-Konto auswählen...",
        selectAccountLabel: "GitHub-Konto",
        chooseAccount: "Wähle, welches GitHub-Konto für dieses Projekt verwendet werden soll",
        primary: "(Primär)",
        selectRepository: "Repository auswählen",
        updateRepos: "Repositorys aktualisieren",
        chooseRepository: "Repository auswählen...",
        reposDescription: "Dies sind die Repositorys, denen du während der Installation Zugriff gewährt hast. Klicke auf \"Repositorys aktualisieren\", um zu ändern, welche Repositorys mit der App geteilt werden.",
        noReposAvailable: "Keine Repositorys verfügbar. Bitte installiere die GitHub App erneut und wähle Repositorys aus.",
        selectFiles: "Dateien zum Prüfen auf Zitate auswählen",
        refresh: "Aktualisieren",
        refreshing: "Wird aktualisiert...",
        selectRepoToSeeFiles: "Wähle oben ein Repository aus, um verfügbare Dateien zu sehen, oder klicke auf die Schaltfläche, um Dateien zu aktualisieren.",
        refreshFiles: "Dateien aktualisieren",
        loading: "Wird geladen...",
        linkedRepository: "Verknüpftes Repository:",
        fileSelected: "{selected} von {total} Datei(en) ausgewählt",
        saveChanges: "Änderungen speichern",
        saving: "Wird gespeichert...",
        unlink: "Verknüpfung aufheben",
        unlinking: "Verknüpfung wird aufgehoben...",
        disconnectDialog: {
          title: "GitHub-Konto trennen",
          description: "Bist du sicher, dass du dein GitHub-Konto trennen möchtest? Du verlierst den Zugriff auf private Repositorys.",
          cancel: "Abbrechen",
          confirm: "Trennen",
        },
        unlinkDialog: {
          title: "GitHub Repository Verknüpfung aufheben",
          description: "Bist du sicher, dass du die Verknüpfung zu diesem GitHub-Repository aufheben möchtest? Die Repository-URL und die ausgewählten Dateien werden von diesem Projekt entfernt.",
          cancel: "Abbrechen",
          confirm: "Verknüpfung aufheben",
        },
        toast: {
          accountLinked: "GitHub-Konto erfolgreich verknüpft!",
          accountDisconnected: "GitHub-Konto getrennt",
          accountUpdated: "GitHub-Konto aktualisiert",
          repoUnlinked: "GitHub-Repository Verknüpfung aufgehoben",
          settingsSaved: "GitHub Repository-Einstellungen gespeichert",
          appInstalled: "GitHub App erfolgreich installiert! Zugriff auf {count} Repository(s) gewährt.",
          filesFound: "{count} Datei(en) gefunden",
          failedToLoad: "Fehler beim Laden der GitHub-Repositorys",
          failedToDisconnect: "Fehler beim Trennen des GitHub-Kontos",
          failedToUpdate: "Fehler beim Aktualisieren des GitHub-Kontos",
          failedToUnlink: "Fehler beim Aufheben der Repository-Verknüpfung",
          failedToSave: "Fehler beim Speichern der Einstellungen",
          failedToSync: "Fehler beim Synchronisieren der Installation. Stelle sicher, dass die Installations-ID korrekt ist und zu deinem Konto gehört.",
          failedToFetchFiles: "Fehler beim Abrufen der Repository-Dateien",
          pleaseSelectRepo: "Bitte wähle ein GitHub-Repository aus",
          unauthorized: "Du bist nicht berechtigt, die GitHub App zu installieren",
          invalidRequest: "Ungültige Anfrage. Bitte versuche es erneut.",
          configError: "GitHub App ist nicht konfiguriert",
          noRepositories: "Während der Installation wurden keine Repositorys ausgewählt",
          internalError: "Ein interner Fehler ist aufgetreten",
          failedToInstall: "Fehler beim Installieren der GitHub App",
          updateReposInfo: "Aktualisiere den Repository-Zugriff und aktualisiere dann diese Seite, um die Änderungen zu sehen",
        },
        errors: {
          repoNotInList: "Repository {repo} befindet sich nicht in der Liste der Repositorys, denen du für {account} Zugriff gewährt hast. Bitte installiere die GitHub App erneut und wähle dieses Repository aus.",
        },
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

