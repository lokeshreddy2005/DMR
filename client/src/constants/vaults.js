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

// Vault color scheme - bg, border, text, bar colors (kept for VaultBrowser compatibility)
export const VAULT_COLORS = {
    academics:       { bg: 'bg-blue-50 dark:bg-blue-900/20',   border: 'border-blue-200 dark:border-blue-800/50',   text: 'text-blue-700 dark:text-blue-300',   bar: 'bg-blue-500' },
    finance:         { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800/50', text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500' },
    operations:      { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800/50', text: 'text-orange-700 dark:text-orange-300', bar: 'bg-orange-500' },
    governance:      { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800/50', text: 'text-purple-700 dark:text-purple-300', bar: 'bg-purple-500' },
    research:        { bg: 'bg-cyan-50 dark:bg-cyan-900/20',    border: 'border-cyan-200 dark:border-cyan-800/50',    text: 'text-cyan-700 dark:text-cyan-300',    bar: 'bg-cyan-500' },
    hr:              { bg: 'bg-pink-50 dark:bg-pink-900/20',    border: 'border-pink-200 dark:border-pink-800/50',    text: 'text-pink-700 dark:text-pink-300',    bar: 'bg-pink-500' },
    engineering:     { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800/50', text: 'text-yellow-700 dark:text-yellow-300', bar: 'bg-yellow-500' },
    marketing:       { bg: 'bg-rose-50 dark:bg-rose-900/20',    border: 'border-rose-200 dark:border-rose-800/50',    text: 'text-rose-700 dark:text-rose-300',    bar: 'bg-rose-500' },
    it_systems:      { bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-800/50', text: 'text-indigo-700 dark:text-indigo-300', bar: 'bg-indigo-500' },
    student_affairs: { bg: 'bg-teal-50 dark:bg-teal-900/20',   border: 'border-teal-200 dark:border-teal-800/50',   text: 'text-teal-700 dark:text-teal-300',   bar: 'bg-teal-500' },
    library_archives:{ bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800/50', text: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-500' },
    events:          { bg: 'bg-fuchsia-50 dark:bg-fuchsia-900/20', border: 'border-fuchsia-200 dark:border-fuchsia-800/50', text: 'text-fuchsia-700 dark:text-fuchsia-300', bar: 'bg-fuchsia-500' },
    miscellaneous:   { bg: 'bg-gray-50 dark:bg-gray-800/40',   border: 'border-gray-200 dark:border-gray-700',      text: 'text-gray-600 dark:text-gray-400',   bar: 'bg-gray-400' },
};

// Default color for unknown vaults
export const DEFAULT_VAULT_COLOR = { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800/50', text: 'text-blue-700 dark:text-blue-300', bar: 'bg-blue-500' };

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
