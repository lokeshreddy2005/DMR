// Minimum confidence score threshold for displaying vaults in previews
// Must match the server's VAULT_THRESHOLD
export const VAULT_THRESHOLD = 0.33;

// Vault icon mappings (kept for backward compatibility but not used in previews)
export const VAULT_ICONS = {
    academics: '🎓',
    finance: '💰',
    operations: '⚙️',
    governance: '⚖️',
    research: '🔬',
    hr: '👥',
    engineering: '🔧',
    marketing: '📣',
    it_systems: '💻',
    student_affairs: '🎒',
    library_archives: '📚',
    events: '🎪',
    miscellaneous: '🗂️',
};

// Single unified color for all vaults
export const VAULT_COLOR = { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800/50', text: 'text-blue-700 dark:text-blue-300', bar: 'bg-blue-500' };

// Vault labels for display
export const VAULT_LABELS = {
    academics:       'Academics',
    finance:         'Finance',
    operations:      'Operations',
    governance:      'Governance & Legal',
    research:        'Research & Innovation',
    hr:              'Human Resources',
    engineering:     'Engineering & Technical',
    marketing:       'Marketing',
    it_systems:      'IT Systems',
    student_affairs: 'Student Affairs',
    library_archives:'Library & Archives',
    events:          'Events',
    miscellaneous:   'Miscellaneous',
};
