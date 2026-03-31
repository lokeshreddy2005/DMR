export function CircularProgress({ percentage, size = 110, strokeWidth = 10 }) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    let colorClass = 'text-emerald-500';
    if (percentage >= 90) colorClass = 'text-red-500';
    else if (percentage >= 70) colorClass = 'text-yellow-500';

    return (
        <div className="relative flex items-center justify-center inline-flex" style={{ width: size, height: size }}>
            <svg className="transform -rotate-90 w-full h-full drop-shadow-sm">
                <circle cx={size/2} cy={size/2} r={radius} className="text-gray-100 dark:text-gray-800 stroke-current" strokeWidth={strokeWidth} fill="transparent" />
                <circle cx={size/2} cy={size/2} r={radius} className={`${colorClass} stroke-current transition-all duration-1000 ease-out`} strokeWidth={strokeWidth} strokeLinecap="round" fill="transparent" strokeDasharray={circumference} strokeDashoffset={offset} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-2xl font-black text-gray-800 dark:text-gray-100">{percentage}%</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5" title="Used">Used</span>
            </div>
        </div>
    );
}

export const getStorageHeaderColor = (percentage) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-emerald-500';
};

export const getWarningMessage = (percentage) => {
    if (percentage >= 90) return "Critical: Almost full!";
    if (percentage >= 80) return "Warning: Running low";
    return null;
};
