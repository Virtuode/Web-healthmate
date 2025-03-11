import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = "" }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 shadow-lg rounded-xl p-4 ${className}`}>
      {children}
    </div>
  );
};

interface CardSectionProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardSectionProps> = ({ children, className = "" }) => {
  return <div className={`pb-2 border-b border-gray-300 dark:border-gray-700 ${className}`}>{children}</div>;
};

export const CardTitle: React.FC<CardSectionProps> = ({ children, className = "" }) => {
  return <h2 className={`text-xl font-semibold text-gray-900 dark:text-white ${className}`}>{children}</h2>;
};

export const CardContent: React.FC<CardSectionProps> = ({ children, className = "" }) => {
  return <div className={`pt-2 ${className}`}>{children}</div>;
};
