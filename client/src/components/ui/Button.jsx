import { forwardRef } from "react";
import { cn } from "../../utils/cn";
import { Loader2 } from "lucide-react";

export const Button = forwardRef(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, leftIcon, rightIcon, ...props }, ref) => {
    
    const baseStyles = "inline-flex items-center justify-center font-semibold rounded-xl transition-all outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]";
    
    const variants = {
      primary: "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/20 border border-transparent",
      secondary: "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 shadow-sm",
      ghost: "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300",
      danger: "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 border border-transparent font-bold",
    };

    const sizes = {
      sm: "h-9 px-4 text-sm",
      md: "h-11 px-6 text-sm",
      lg: "h-14 px-8 text-base",
      icon: "h-11 w-11",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {!isLoading && leftIcon && <span className="mr-2.5">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="ml-2.5">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";
