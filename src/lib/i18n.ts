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
    account: {
      title: "Account Settings",
      description: "Manage your account access and security.",
      loginRequiredTitle: "Login required",
      loginRequiredDescription: "Please log in to manage your account settings.",
      oauth: {
        menuItem: "OAuth",
        title: "OAuth Login",
        description: "Manage linked OAuth providers and linking behavior.",
        reauthDescription:
          "For security reasons, please verify by logging in again before you can manage OAuth providers.",
        reauthAction: "Re-login to verify",
        reauthing: "Preparing re-login...",
        reauthRequiredHint: "Re-login is required before changing OAuth settings.",
        reauthRequiredToast: "Please re-login before changing OAuth settings.",
        preventCrossProviderTitle: "Prevent automatic cross-provider linking",
        preventCrossProviderDescription:
          "If enabled, signing in with a different OAuth provider for the same email is blocked unless accounts are linked manually here.",
        providerPolicySavedToast: "OAuth provider policy updated.",
        linkedProvidersTitle: "Linked OAuth providers",
        loadingProviders: "Loading linked providers...",
        noLinkedProviders: "No OAuth providers linked yet.",
        unlinkAction: "Unlink",
        unlinkedToast: "OAuth provider unlinked.",
        lastProviderError: "At least one OAuth provider must stay linked to this account.",
        lastProviderHint: "You can only unlink providers while at least one linked provider remains.",
        linkProvidersTitle: "Link another OAuth provider",
        allProvidersLinked: "All available OAuth providers are already linked.",
        linkWarning:
          "If the OAuth account you are linking already exists separately, that existing account data will be permanently deleted after you complete ownership verification.",
        linkConfirmTitle: "Link OAuth provider",
        linkConfirmDescription:
          "To continue, confirm that any existing account tied to this OAuth login may be deleted permanently during the linking process.",
        linkConfirmPhraseLabel: "Type {phrase} to continue:",
        linkConfirmPhraseError: "Please type {phrase} to confirm linking.",
        linkAction: "Link provider",
        linking: "Linking...",
        crossProviderDisabledError:
          "Only one account is allowed per mail address and you have disabled automatic cross-provider linking in your account settings.",
        accountAlreadyLinkedError:
          "This OAuth account is already linked to a different user. Please sign in with that account first if you want to merge.",
        accountNotLinkedForProviderError:
          "Linking this provider is currently not allowed. Please verify provider email permissions and try again.",
        linkConflictTitle: "Resolve OAuth account conflict",
        linkConflictRuleAllDeleted:
          "The old account only uses this email address. It will be deleted, and all links for this email will move to your current account.",
        linkConflictKeepMessage:
          "The old account will be kept. Only links for the moved email will be transferred to your current account.",
        linkConflictKeepLinksTitle: "The old account keeps these linked provider/email combinations:",
        linkConflictRulePartialKeep:
          "If the old account also has links with a different email, only links for this email will be moved. The old account remains with its other email links.",
        linkConflictConfirmPhraseLabel: "Type {phrase} to continue:",
        linkConflictConfirmPhraseError: "Please type {phrase} to confirm.",
        linkConflictConfirmAction: "Continue and re-login",
        linkConflictContinueAction: "Continue",
        linkConflictDeleteAction: "Continue and delete",
        linkConflictReauthToast:
          "Please log in with the conflicting provider account to complete the merge.",
        mergeCompletedDeletedSourceToast:
          "OAuth links were moved. The old account was deleted. Please log in again.",
        mergeCompletedRetainedSourceToast:
          "OAuth links for this email were moved. The old account remains with other email links.",
        conflictCouldNotBeResolvedError:
          "We could not determine the conflicting account automatically. Please sign in once with the conflicting account and try again.",
      },
      displayInformation: {
        menuItem: "Display information",
        title: "Display information",
        description: "Choose how your name, email, and profile picture appear in the app.",
        loading: "Loading display settings...",
        displayNameLabel: "Display name",
        displayNameHint:
          "When you first sign up with a provider, this is prefilled from your provider profile (or from the part before @ in your email if no name is provided). You can change it any time.",
        displayEmailLabel: "Email shown in the app",
        displayEmailHint: "Pick from addresses linked to your OAuth providers.",
        displayImageLabel: "Profile picture",
        displayImageHint:
          "Use the default icon, any image file placed in public/avatars (shown automatically), or a linked provider avatar.",
        defaultAvatarLabel: "Default icon",
        saveAction: "Save display settings",
        saving: "Saving...",
        savedToast: "Display settings saved.",
        invalidNameToast: "Please enter a display name.",
        invalidEmailToast: "That email is not linked to your account.",
        invalidImageToast: "That profile picture option is not available.",
        invalidPresetAvatarToast: "That built-in avatar is not available or was removed from the server.",
      },
      delete: {
        menuItem: "Delete account",
        title: "Delete account",
        description: "Permanently remove your account and all related data from the server.",
        scope: "This includes your profile, sessions, projects, sources, citations, tags, and linked OAuth accounts.",
        reauthDescription: "For security reasons, please verify by logging in again before you can delete your account.",
        reauthAction: "Re-login to verify",
        reauthing: "Preparing re-login...",
        reauthRequiredToast: "Please re-login and try deleting your account again.",
        confirmPhraseLabel: "Type {phrase} to confirm:",
        confirmPhraseError: "Please type DELETE to confirm account deletion.",
        action: "Delete account permanently",
        confirmAction: "Yes, delete my account",
        dialogTitle: "Delete account permanently?",
        dialogDescription: "This action cannot be undone. All associated data and OAuth links will be deleted.",
        deleting: "Deleting account...",
        deletedToast: "Account deleted successfully.",
      },
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
      google: "Google",
      discord: "Discord",
      atlassian: "Atlassian",
    },
    authError: {
      unableToLinkTitle: "Sign-in could not be completed",
      unableToLinkIntro:
        "The provider could not be linked to your account. This often happens when automatic cross-provider linking is turned off in Account Settings, and you already use another OAuth provider with the same email address.",
      unableToLinkWhatYouCanDo: "What you can do",
      unableToLinkOptionA:
        "Sign in again using a provider you have already linked to this account, then add the new provider from Account → Settings → OAuth if you want both.",
      unableToLinkOptionB:
        "Or turn off “Prevent automatic cross-provider linking” in Account Settings if you want future sign-ins with another provider (same email) to attach automatically.",
      signInAgain: "Back to sign in",
      goHome: "Go to home",
      accountSettings: "Open account settings",
      genericTitle: "Something went wrong",
      genericDescription:
        "We could not finish authentication. You can try signing in again from the home page.",
      codeLabel: "Error code",
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
      autoGenerateBibtex: "Auto-generate BibTeX",
      bibtexGenerated: "BibTeX generated successfully",
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
      pdfExport: {
        title: "Export to PDF",
        description: "Configure your PDF export options",
        includeValues: "Include Values",
        columns: "Columns",
        apaCitation: "APA Citation",
        citationCount: "Citation Count",
        sorting: "Sorting",
        sortByTitleAsc: "Alphabetical by Title (A-Z)",
        sortByTitleDesc: "Alphabetical by Title (Z-A)",
        sortByDate: "By Date",
        sortByAbbreviation: "By Abbreviation",
        sortByAPA: "By APA Standard",
        displayFormat: "Display Format",
        formatTabular: "Tabular (all sources as a table)",
        formatList: "List (one source beneath the other)",
        pageOptions: "Page Options",
        noPageOverlap: "Prevent page overlap (move source to next page if it doesn't fit)",
        newPagePerSource: "New page for each source",
        fontOptions: "Font Options",
        font: "Font",
        fontSize: "Font Size",
        headerOptions: "Header Options",
        includeProjectTitle: "Include project title",
        includeProjectDescription: "Include project description",
        includeAuthor: "Include author",
        authorName: "Author name",
        authorNamePlaceholder: "Author name",
        includeDownloadDate: "Include download date",
        includeSourceManagerNote: "Include \"Downloaded via Source Manager\" note",
        cancel: "Cancel",
        export: "Export PDF",
      },
    },
    settings: {
      title: "Settings",
      projectSettings: "Project settings for",
      github: {
        title: "GitHub Repository",
        description: "Link your GitHub account to access repositories and check for citations in selected files",
        accountRequired: "GitHub Account Required",
        accountRequiredDescription: "You logged in with GitHub, but you need to install the GitHub App and select repositories to access them.",
        accountRequiredDescriptionNotLinked: "You need to link your GitHub account to access repositories. If you logged in with GitHub, please install the GitHub App and select which repositories to grant access to.",
        linkAccount: "Link GitHub Account",
        linkGitHub: "Link GitHub",
        connecting: "Connecting...",
        syncExistingInstallation: "Sync Existing Installation",
        accountLinked: "GitHub Account Linked",
        accountNotLinked: "GitHub Account Not Linked",
        linkAccountToAccess: "Link your GitHub account to access repositories",
        accessGranted: "Access granted to {count} repository(ies)",
        accessGrantedOne: "Access granted to 1 repository",
        loadingRepos: "Loading repositories...",
        disconnect: "Disconnect",
        disconnecting: "Disconnecting...",
        selectAccount: "Select GitHub account...",
        selectAccountLabel: "GitHub Account",
        chooseAccount: "Choose which GitHub account to use for this project",
        primary: "(Primary)",
        selectRepository: "Select Repository",
        updateRepos: "Update Repos",
        chooseRepository: "Choose a repository...",
        reposDescription: "These are the repositories you granted access to during installation. Click \"Update Repos\" to change which repositories are shared with the app.",
        noReposAvailable: "No repositories available. Please reinstall the GitHub App and select repositories.",
        selectFiles: "Select files to check for citations",
        refresh: "Refresh",
        refreshing: "Refreshing...",
        selectRepoToSeeFiles: "Select a repository above to see available files, or click the button to refresh files.",
        refreshFiles: "Refresh Files",
        loading: "Loading...",
        linkedRepository: "Linked repository:",
        fileSelected: "{selected} of {total} file(s) selected",
        saveChanges: "Save Changes",
        saving: "Saving...",
        unlink: "Unlink",
        unlinking: "Unlinking...",
        disconnectDialog: {
          title: "Disconnect GitHub Account",
          description: "Are you sure you want to disconnect your GitHub account? You will lose access to private repositories.",
          cancel: "Cancel",
          confirm: "Disconnect",
        },
        unlinkDialog: {
          title: "Unlink GitHub Repository",
          description: "Are you sure you want to unlink this GitHub repository? The repository URL and selected files will be removed from this project.",
          cancel: "Cancel",
          confirm: "Unlink",
        },
        toast: {
          accountLinked: "GitHub account linked successfully!",
          accountDisconnected: "GitHub account disconnected",
          accountUpdated: "GitHub account updated",
          repoUnlinked: "GitHub repository unlinked",
          settingsSaved: "GitHub repository settings saved",
          appInstalled: "GitHub App installed successfully! Access granted to {count} repository(ies).",
          filesFound: "Found {count} file(s)",
          failedToLoad: "Failed to load GitHub repositories",
          failedToDisconnect: "Failed to disconnect GitHub account",
          failedToUpdate: "Failed to update GitHub account",
          failedToUnlink: "Failed to unlink repository",
          failedToSave: "Failed to save settings",
          failedToSync: "Failed to sync installation. Make sure the installation ID is correct and belongs to your account.",
          failedToFetchFiles: "Failed to fetch repository files",
          pleaseSelectRepo: "Please select a GitHub repository",
          unauthorized: "You are not authorized to install the GitHub App",
          invalidRequest: "Invalid request. Please try again.",
          configError: "GitHub App is not configured",
          noRepositories: "No repositories were selected during installation",
          internalError: "An internal error occurred",
          failedToInstall: "Failed to install GitHub App",
          updateReposInfo: "Update the repository access and then refresh this page to see changes",
        },
        errors: {
          repoNotInList: "Repository {repo} is not in the list of repositories you granted access to for {account}. Please reinstall the GitHub App and select this repository.",
        },
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
    account: {
      title: "Kontoeinstellungen",
      description: "Verwalte den Zugriff und die Sicherheit deines Kontos.",
      loginRequiredTitle: "Anmeldung erforderlich",
      loginRequiredDescription: "Bitte melde dich an, um deine Kontoeinstellungen zu verwalten.",
      oauth: {
        menuItem: "OAuth",
        title: "OAuth-Login",
        description: "Verwalte verknüpfte OAuth-Anbieter und das Verknüpfungsverhalten.",
        reauthDescription:
          "Aus Sicherheitsgründen musst du dich erneut anmelden, bevor du OAuth-Anbieter verwalten kannst.",
        reauthAction: "Erneut anmelden zur Verifizierung",
        reauthing: "Anmeldung wird vorbereitet...",
        reauthRequiredHint: "Erneute Anmeldung ist erforderlich, bevor du OAuth-Einstellungen ändern kannst.",
        reauthRequiredToast: "Bitte melde dich erneut an, bevor du OAuth-Einstellungen änderst.",
        preventCrossProviderTitle: "Automatische providerübergreifende Verknüpfung verhindern",
        preventCrossProviderDescription:
          "Wenn aktiviert, wird die Anmeldung mit einem anderen OAuth-Anbieter bei derselben E-Mail blockiert, außer Konten werden hier manuell verknüpft.",
        providerPolicySavedToast: "OAuth-Anbieter-Richtlinie wurde aktualisiert.",
        linkedProvidersTitle: "Verknüpfte OAuth-Anbieter",
        loadingProviders: "Verknüpfte Anbieter werden geladen...",
        noLinkedProviders: "Es sind noch keine OAuth-Anbieter verknüpft.",
        unlinkAction: "Trennen",
        unlinkedToast: "OAuth-Anbieter wurde getrennt.",
        lastProviderError: "Mindestens ein OAuth-Anbieter muss mit diesem Konto verknüpft bleiben.",
        lastProviderHint:
          "Du kannst Anbieter nur trennen, solange mindestens ein verknüpfter Anbieter verbleibt.",
        linkProvidersTitle: "Weiteren OAuth-Anbieter verknüpfen",
        allProvidersLinked: "Alle verfügbaren OAuth-Anbieter sind bereits verknüpft.",
        linkWarning:
          "Wenn das zu verknüpfende OAuth-Konto bereits separat existiert, werden dessen Kontodaten nach erfolgreicher Eigentumsbestätigung dauerhaft gelöscht.",
        linkConfirmTitle: "OAuth-Anbieter verknüpfen",
        linkConfirmDescription:
          "Bestätige zum Fortfahren, dass ein bestehendes Konto für diesen OAuth-Login während der Verknüpfung dauerhaft gelöscht werden kann.",
        linkConfirmPhraseLabel: "Gib {phrase} ein, um fortzufahren:",
        linkConfirmPhraseError: "Bitte gib {phrase} ein, um die Verknüpfung zu bestätigen.",
        linkAction: "Anbieter verknüpfen",
        linking: "Wird verknüpft...",
        crossProviderDisabledError:
          "Pro E-Mail-Adresse ist nur ein Konto erlaubt und du hast die automatische providerübergreifende Verknüpfung in den Kontoeinstellungen deaktiviert.",
        accountAlreadyLinkedError:
          "Dieses OAuth-Konto ist bereits mit einem anderen Benutzer verknüpft. Melde dich zuerst mit diesem Konto an, wenn du zusammenführen möchtest.",
        accountNotLinkedForProviderError:
          "Das Verknüpfen dieses Anbieters ist derzeit nicht erlaubt. Prüfe die E-Mail-Berechtigungen des Anbieters und versuche es erneut.",
        linkConflictTitle: "OAuth-Konto-Konflikt lösen",
        linkConflictRuleAllDeleted:
          "Das alte Konto nutzt nur diese E-Mail-Adresse. Es wird gelöscht, und alle Verknüpfungen für diese E-Mail werden in dein aktuelles Konto verschoben.",
        linkConflictKeepMessage:
          "Das alte Konto bleibt bestehen. Nur Verknüpfungen für die verschobene E-Mail werden in dein aktuelles Konto übertragen.",
        linkConflictKeepLinksTitle:
          "Das alte Konto behält diese verknüpften Anbieter-/E-Mail-Kombinationen:",
        linkConflictRulePartialKeep:
          "Wenn das alte Konto zusätzlich Verknüpfungen mit einer anderen E-Mail hat, werden nur Verknüpfungen für diese E-Mail verschoben. Das alte Konto bleibt mit den anderen E-Mail-Verknüpfungen bestehen.",
        linkConflictConfirmPhraseLabel: "Gib {phrase} ein, um fortzufahren:",
        linkConflictConfirmPhraseError: "Bitte gib {phrase} zur Bestätigung ein.",
        linkConflictConfirmAction: "Fortfahren und erneut anmelden",
        linkConflictContinueAction: "Fortfahren",
        linkConflictDeleteAction: "Fortfahren und löschen",
        linkConflictReauthToast:
          "Bitte melde dich mit dem konfliktierenden Provider-Konto an, um das Zusammenführen abzuschließen.",
        mergeCompletedDeletedSourceToast:
          "OAuth-Verknüpfungen wurden verschoben. Das alte Konto wurde gelöscht. Bitte melde dich erneut an.",
        mergeCompletedRetainedSourceToast:
          "OAuth-Verknüpfungen für diese E-Mail wurden verschoben. Das alte Konto bleibt mit anderen E-Mail-Verknüpfungen bestehen.",
        conflictCouldNotBeResolvedError:
          "Das konfliktierende Konto konnte nicht automatisch ermittelt werden. Melde dich einmal mit dem konfliktierenden Konto an und versuche es erneut.",
      },
      displayInformation: {
        menuItem: "Anzeigeinformationen",
        title: "Anzeigeinformationen",
        description: "Lege fest, wie Name, E-Mail und Profilbild in der App angezeigt werden.",
        loading: "Anzeige-Einstellungen werden geladen...",
        displayNameLabel: "Anzeigename",
        displayNameHint:
          "Bei der ersten Anmeldung mit einem Anbieter wird dies aus dem Anbieterprofil übernommen (oder aus dem Teil vor dem @ in deiner E-Mail, falls kein Name vorliegt). Du kannst es jederzeit ändern.",
        displayEmailLabel: "In der App angezeigte E-Mail",
        displayEmailHint: "Wähle aus den Adressen, die mit deinen OAuth-Anbietern verknüpft sind.",
        displayImageLabel: "Profilbild",
        displayImageHint:
          "Nutze das Standard-Symbol, eine Bilddatei in public/avatars (wird automatisch angezeigt) oder ein verknüpftes Anbieter-Avatar.",
        defaultAvatarLabel: "Standard-Symbol",
        saveAction: "Anzeige-Einstellungen speichern",
        saving: "Wird gespeichert...",
        savedToast: "Anzeige-Einstellungen wurden gespeichert.",
        invalidNameToast: "Bitte gib einen Anzeigenamen ein.",
        invalidEmailToast: "Diese E-Mail ist mit deinem Konto nicht verknüpft.",
        invalidImageToast: "Diese Profilbild-Option ist nicht verfügbar.",
        invalidPresetAvatarToast:
          "Dieser eingebaute Avatar ist nicht verfügbar oder wurde vom Server entfernt.",
      },
      delete: {
        menuItem: "Konto löschen",
        title: "Konto löschen",
        description: "Entfernt dein Konto und alle zugehörigen Daten dauerhaft vom Server.",
        scope: "Dazu gehören Profil, Sitzungen, Projekte, Quellen, Zitate, Tags und verknüpfte OAuth-Konten.",
        reauthDescription: "Aus Sicherheitsgründen musst du dich erneut anmelden, bevor du dein Konto löschen kannst.",
        reauthAction: "Erneut anmelden zur Verifizierung",
        reauthing: "Anmeldung wird vorbereitet...",
        reauthRequiredToast: "Bitte melde dich erneut an und versuche die Kontolöschung danach erneut.",
        confirmPhraseLabel: "Gib {phrase} zur Bestätigung ein:",
        confirmPhraseError: "Bitte gib DELETE ein, um die Kontolöschung zu bestätigen.",
        action: "Konto dauerhaft löschen",
        confirmAction: "Ja, mein Konto löschen",
        dialogTitle: "Konto dauerhaft löschen?",
        dialogDescription: "Diese Aktion kann nicht rückgängig gemacht werden. Alle zugehörigen Daten und OAuth-Verknüpfungen werden gelöscht.",
        deleting: "Konto wird gelöscht...",
        deletedToast: "Konto erfolgreich gelöscht.",
      },
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
      google: "Google",
      discord: "Discord",
      atlassian: "Atlassian",
    },
    authError: {
      unableToLinkTitle: "Anmeldung konnte nicht abgeschlossen werden",
      unableToLinkIntro:
        "Der Anbieter konnte nicht mit deinem Konto verknüpft werden. Das passiert oft, wenn die automatische providerübergreifende Verknüpfung in den Kontoeinstellungen deaktiviert ist und du bereits einen anderen OAuth-Anbieter mit derselben E-Mail-Adresse nutzt.",
      unableToLinkWhatYouCanDo: "Was du tun kannst",
      unableToLinkOptionA:
        "Melde dich erneut mit einem Anbieter an, der bereits mit diesem Konto verknüpft ist, und füge den neuen Anbieter bei Bedarf unter Konto → Einstellungen → OAuth hinzu.",
      unableToLinkOptionB:
        "Oder deaktiviere die Option „Automatische providerübergreifende Verknüpfung verhindern“ in den Kontoeinstellungen, wenn zukünftige Anmeldungen mit einem anderen Anbieter (gleiche E-Mail) automatisch verknüpft werden sollen.",
      signInAgain: "Zur Anmeldung",
      goHome: "Zur Startseite",
      accountSettings: "Kontoeinstellungen öffnen",
      genericTitle: "Etwas ist schiefgelaufen",
      genericDescription:
        "Die Authentifizierung konnte nicht abgeschlossen werden. Versuche es erneut über die Anmeldung auf der Startseite.",
      codeLabel: "Fehlercode",
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
      autoGenerateBibtex: "BibTeX automatisch generieren",
      bibtexGenerated: "BibTeX erfolgreich generiert",
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
      pdfExport: {
        title: "Als PDF exportieren",
        description: "Konfigurieren Sie Ihre PDF-Exportoptionen",
        includeValues: "Werte einschließen",
        columns: "Spalten",
        apaCitation: "APA-Zitat",
        citationCount: "Zitatanzahl",
        sorting: "Sortierung",
        sortByTitleAsc: "Alphabetisch nach Titel (A-Z)",
        sortByTitleDesc: "Alphabetisch nach Titel (Z-A)",
        sortByDate: "Nach Datum",
        sortByAbbreviation: "Nach Abkürzung",
        sortByAPA: "Nach APA-Standard",
        displayFormat: "Anzeigeformat",
        formatTabular: "Tabellarisch (alle Quellen als Tabelle)",
        formatList: "Liste (eine Quelle unter der anderen)",
        pageOptions: "Seitenoptionen",
        noPageOverlap: "Seitenüberlappung verhindern (Quelle auf nächste Seite verschieben, wenn sie nicht passt)",
        newPagePerSource: "Neue Seite für jede Quelle",
        fontOptions: "Schriftoptionen",
        font: "Schriftart",
        fontSize: "Schriftgröße",
        headerOptions: "Kopfzeilenoptionen",
        includeProjectTitle: "Projekttitel einschließen",
        includeProjectDescription: "Projektbeschreibung einschließen",
        includeAuthor: "Autor einschließen",
        authorName: "Autorenname",
        authorNamePlaceholder: "Autorenname",
        includeDownloadDate: "Download-Datum einschließen",
        includeSourceManagerNote: "Hinweis \"Über Source Manager heruntergeladen\" einschließen",
        cancel: "Abbrechen",
        export: "PDF exportieren",
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

