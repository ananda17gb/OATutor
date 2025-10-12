import React from "react";
import { Box } from "@material-ui/core";

const ProgressBar = ({ mastery, showPercentage = true }) => {
    const percentage = Math.round(mastery * 100);

    const getBarColor = () => {
        if (percentage >= 90) return "#10b981"; // Softer green
        if (percentage >= 70) return "#f59e0b"; // Amber orange  
        if (percentage >= 50) return "#3b82f6"; // Blue for medium progress
        return "#ef4444"; // Red for low progress
    };

    return (
        <Box display="flex" alignItems="center" style={{ gap: '10px' }}>
            <Box flex={1} style={{
                backgroundColor: '#e5e7eb', // Light gray background
                borderRadius: '5px',
                overflow: 'hidden',
                maxWidth: '175px',
                marginLeft: 'auto'
            }}>
                <div style={{
                    backgroundColor: getBarColor(),
                    height: '10px',
                    width: `${percentage}%`,
                    transition: 'width 0.3s ease, background-color 0.3s ease',
                    borderRadius: '5px'
                }} />
            </Box>
            {showPercentage && (
                <div style={{
                    // minWidth: '30px',
                    textAlign: 'right'
                }}>
                    {percentage}%
                </div>
            )}
        </Box>
    );
};

export default ProgressBar;
