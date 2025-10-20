import React, { useState, useEffect } from 'react';

const BadgeDisplay = ({ userId, firebase, browserStorage, pointsService }) => {
    const [badges, setBadges] = useState([]);
    const [newBadges, setNewBadges] = useState([]);
    const [showNotification, setShowNotification] = useState(false);
    const [progress, setProgress] = useState(null);

    useEffect(() => {
        if (!pointsService) return;

        // Set up badge update callback
        pointsService.setBadgeUpdateCallback((newBadges) => {
            setNewBadges(newBadges);
            setShowNotification(true);

            // Auto-hide notification after 5 seconds
            setTimeout(() => {
                setShowNotification(false);
            }, 5000);
            loadBadges();
        });

        // pointsService.setPointsUpdateCallback((progress) => {
        //     setProgress(progress);
        // })

        // ✅ FIXED: Handle both number and object formats
        // pointsService.setPointsUpdateCallback(() => {
        //     const currentProgress = pointsService.getCurrentProgress();
        //     setProgress(currentProgress);
        // });

        // Load existing badges
        loadBadges();
        updateProgress();

        const progressInterval = setInterval(updateProgress, 3000);
        return () => clearInterval(progressInterval);

    }, [pointsService]);

    const loadBadges = async () => {
        if (pointsService) {
            const earnedBadges = await pointsService.getEarnedBadges();
            setBadges(earnedBadges);
        }
    };

    const updateProgress = () => {
        if (pointsService) {
            const currentProgress = pointsService.getCurrentProgress();
            setProgress(currentProgress);
        }
    };

    const getBadgeProgress = (badgeId) => {
        if (!progress) return null;

        const badgeDefinitions = {
            'first_problem': { target: 1, current: progress.totalProblemsCompleted + progress.sessionProblemsCompleted },
            'lesson_master': { target: 5, current: progress.totalLessonsCompleted + progress.sessionLessonsCompleted },
            'problem_solver': { target: 50, current: progress.totalProblemsCompleted + progress.sessionProblemsCompleted }
        };

        return badgeDefinitions[badgeId];
    };

    const isBadgeInProgress = (badgeId) => {
        const badgeProgress = getBadgeProgress(badgeId);
        if (!badgeProgress) return false;
        return badgeProgress.current > 0 && badgeProgress.current < badgeProgress.target;
    };

    const getBadgeProgressPercentage = (badgeId) => {
        const badgeProgress = getBadgeProgress(badgeId);
        if (!badgeProgress) return 0;
        return Math.min(100, (badgeProgress.current / badgeProgress.target) * 100);
    };

    return (
        <div style={{ position: 'relative' }}>
            {/* Badge Notification */}
            {showNotification && newBadges.length > 0 && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    padding: '15px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                    zIndex: 1000,
                    minWidth: '300px',
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    <h4 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🎉 New Badges Earned!
                    </h4>
                    {newBadges.map(badge => (
                        <div key={badge.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            margin: '8px 0',
                            padding: '8px',
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            borderRadius: '4px'
                        }}>
                            <span style={{ fontSize: '24px', marginRight: '10px' }}>
                                {badge.icon}
                            </span>
                            <div style={{ flex: 1 }}>
                                <strong>{badge.name}</strong>
                                <div style={{ fontSize: '12px', opacity: 0.9 }}>{badge.description}</div>
                            </div>
                        </div>
                    ))}
                    <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '8px' }}>
                        Badges saved to your profile
                    </div>
                </div>
            )}

            {/* Badge Display */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {badges.map(badge => (
                    <div key={badge.id} style={{
                        padding: '12px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '12px',
                        textAlign: 'center',
                        minWidth: '90px',
                        border: '2px solid #e9ecef',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        position: 'relative'
                    }} title={badge.description}>
                        <div style={{ fontSize: '28px', marginBottom: '4px' }}>{badge.icon}</div>
                        <div style={{
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: '#495057'
                        }}>
                            {badge.name}
                        </div>
                        <div style={{
                            fontSize: '9px',
                            color: '#6c757d',
                            marginTop: '2px'
                        }}>
                            Earned {new Date(badge.earnedAt).toLocaleDateString()}
                        </div>
                    </div>
                ))}

                {/* Progress Indicators for Unearned Badges */}
                {progress && (
                    <>
                        {/* First Problem Badge Progress */}
                        {progress.totalProblemsCompleted + progress.sessionProblemsCompleted === 0 && (
                            <div style={{
                                padding: '12px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '12px',
                                textAlign: 'center',
                                minWidth: '90px',
                                border: '2px dashed #dee2e6',
                                opacity: 0.6
                            }} title="Complete your first problem to earn this badge">
                                <div style={{ fontSize: '28px', marginBottom: '4px' }}>🚀</div>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6c757d' }}>
                                    First Step
                                </div>
                                <div style={{ fontSize: '9px', color: '#adb5bd', marginTop: '2px' }}>
                                    0/1 problems
                                </div>
                            </div>
                        )}

                        {/* Lesson Master Progress */}
                        {progress.totalLessonsCompleted + progress.sessionLessonsCompleted < 5 && (
                            <div style={{
                                padding: '12px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '12px',
                                textAlign: 'center',
                                minWidth: '90px',
                                border: '2px dashed #dee2e6',
                                opacity: isBadgeInProgress('lesson_master') ? 1 : 0.6,
                                position: 'relative'
                            }} title={`Complete ${5 - (progress.totalLessonsCompleted + progress.sessionLessonsCompleted)} more lessons`}>
                                <div style={{ fontSize: '28px', marginBottom: '4px' }}>🎓</div>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6c757d' }}>
                                    Lesson Master
                                </div>
                                <div style={{ fontSize: '9px', color: '#adb5bd', marginTop: '2px' }}>
                                    {progress.totalLessonsCompleted + progress.sessionLessonsCompleted}/5 lessons
                                </div>
                                {isBadgeInProgress('lesson_master') && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '4px',
                                        left: '8px',
                                        right: '8px',
                                        height: '3px',
                                        backgroundColor: '#e9ecef',
                                        borderRadius: '2px',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            height: '100%',
                                            backgroundColor: '#4CAF50',
                                            width: `${getBadgeProgressPercentage('lesson_master')}%`,
                                            transition: 'width 0.3s ease'
                                        }} />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Problem Solver Progress */}
                        {progress.totalProblemsCompleted + progress.sessionProblemsCompleted < 50 && (
                            <div style={{
                                padding: '12px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '12px',
                                textAlign: 'center',
                                minWidth: '90px',
                                border: '2px dashed #dee2e6',
                                opacity: isBadgeInProgress('problem_solver') ? 1 : 0.6,
                                position: 'relative'
                            }} title={`Complete ${50 - (progress.totalProblemsCompleted + progress.sessionProblemsCompleted)} more problems`}>
                                <div style={{ fontSize: '28px', marginBottom: '4px' }}>💡</div>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6c757d' }}>
                                    Problem Solver
                                </div>
                                <div style={{ fontSize: '9px', color: '#adb5bd', marginTop: '2px' }}>
                                    {progress.totalProblemsCompleted + progress.sessionProblemsCompleted}/50 problems
                                </div>
                                {isBadgeInProgress('problem_solver') && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '4px',
                                        left: '8px',
                                        right: '8px',
                                        height: '3px',
                                        backgroundColor: '#e9ecef',
                                        borderRadius: '2px',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            height: '100%',
                                            backgroundColor: '#4CAF50',
                                            width: `${getBadgeProgressPercentage('problem_solver')}%`,
                                            transition: 'width 0.3s ease'
                                        }} />
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Progress Summary */}
            {progress && (
                <div style={{
                    marginTop: '12px',
                    padding: '8px 12px',
                    backgroundColor: '#e7f3ff',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: '#0066cc'
                }}>
                    <strong>Session Progress:</strong> {progress.sessionProblemsCompleted} problems completed this session •
                    <strong> Total:</strong> {progress.totalProblemsCompleted + progress.sessionProblemsCompleted} problems •
                    <strong> Lessons:</strong> {progress.totalLessonsCompleted + progress.sessionLessonsCompleted}
                    {progress.sessionProblemsCompleted > 0 && (
                        <span style={{ fontWeight: 'bold', marginLeft: '8px' }}>
                            (Changes save when you click "Next Problem")
                        </span>
                    )}
                </div>
            )}

            <style>
                {`
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                `}
            </style>
        </div>
    );
};

export default BadgeDisplay;
