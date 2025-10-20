import React, { useState, useEffect } from 'react';

const PointsDisplay = ({ userId, firebase, browserStorage, pointsService, showLabel = true }) => {
    const [points, setPoints] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!pointsService) {
            console.log('🎯 PointsDisplay: No points service available');

            setIsLoading(false);
            return;
        }


        let isMounted = true;

        const initializePoints = async () => {
            try {
                // Wait for points service to initialize and load current points
                console.log('🎯 PointsDisplay: Initializing points...');

                await pointsService.loadCurrentPoints();

                // Get initial points after loading
                if (isMounted) {
                    const currentPoints = pointsService.getCurrentPoints();
                    console.log('🎯 PointsDisplay initialized with points:', currentPoints);
                    setPoints(currentPoints);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('Error loading points:', error);
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };


        // Set up real-time updates
        // const handlePointsUpdate = (newPoints) => {
        //     console.log('🎯 PointsDisplay received update:', newPoints);
        //     if (isMounted) { setPoints(newPoints); }
        // };

        // ✅ FIXED: Handle both number (old) and object (new) formats
        const handlePointsUpdate = (progressOrPoints) => {
            console.log('🎯 PointsDisplay: Received update callback!', {
                value: progressOrPoints,
                type: typeof progressOrPoints,
                isMounted: isMounted
            });
            if (isMounted) {
                // If it's an object with totalPoints, use that; otherwise treat as number
                const newPoints = typeof progressOrPoints === 'object'
                    ? progressOrPoints.totalPoints
                    : progressOrPoints;
                console.log('🎯 PointsDisplay: Setting points to:', newPoints);

                setPoints(newPoints);
            }
        };
        console.log('🎯 PointsDisplay: Setting up callback with pointsService');

        pointsService.setPointsUpdateCallback(handlePointsUpdate);

        initializePoints();

        return () => {
            isMounted = false;
            pointsService.setPointsUpdateCallback(null);
        };
    }, [pointsService]);

    if (isLoading) {
        return <div style={{ opacity: 0.7, fontSize: '0.9em' }}>Loading points...</div>;
    }

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
        }}>
            {showLabel && <span>Points:</span>}
            <strong style={{
                minWidth: '30px', // Ensure consistent width
                textAlign: 'center'
            }}>{points}</strong>
        </div>
    );
};

export default PointsDisplay;
