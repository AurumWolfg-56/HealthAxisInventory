import React from 'react';

// Simple Markdown Parser for Protocol Content
export const RichTextContent: React.FC<{ content: string }> = ({ content }) => {
    const renderContent = () => {
        return content.split('\n').map((line, index) => {
            // Bold rule: **text**
            const bolded = line.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={i} className="font-bold text-slate-900 dark:text-white">{part.replace(/\*\*/g, '')}</strong>;
                }
                return part;
            });

            // List rule: `- item` or `* item`
            if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                return (
                    <div key={index} className="flex gap-3 mb-2">
                        <span className="text-medical-500 mt-1">•</span>
                        <span>{bolded}</span>
                    </div>
                );
            }

            // Numbered list rule: `1. item`
            if (/^\d+\.\s/.test(line.trim())) {
                const numMatch = line.trim().match(/^(\d+\.)\s/);
                const prefix = numMatch ? numMatch[1] : '';
                const text = line.trim().replace(/^(\d+\.)\s/, '');

                // re-apply bolded just to text
                const boldedText = text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={i} className="font-bold text-slate-900 dark:text-white">{part.replace(/\*\*/g, '')}</strong>;
                    }
                    return part;
                });

                return (
                    <div key={index} className="flex gap-3 mb-2">
                        <span className="text-medical-600 dark:text-medical-400 font-bold mt-1">{prefix}</span>
                        <span>{boldedText}</span>
                    </div>
                );
            }

            return <div key={index} className="mb-2 min-h-[1rem]">{bolded}</div>;
        });
    };

    return <div className="text-slate-700 dark:text-slate-300 space-y-1">{renderContent()}</div>;
};
