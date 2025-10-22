import React, { useContext, useState, useEffect } from "react";
import { findLessonById, _lessonPlansNoEditor, ThemeContext, findCourseByLessonId, _coursePlansNoEditor } from "../config/config";
import { AppBar, Box, Toolbar, Button } from "@material-ui/core";
import Grid from "@material-ui/core/Grid";
import Divider from "@material-ui/core/Divider";
import BrandLogoNav from "@components/BrandLogoNav";
import Spacer from "@components/Spacer";
import { withRouter } from "react-router-dom";
import Leaderboard from "@components/Leaderboard"
import { PointsService } from "../services/PointsService"
import { LeaderboardService } from "../services/LeaderboardService"

const AssignmentFinished = (props) => {
    const { history, location } = props;
    const context = useContext(ThemeContext);

    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const [leaderboardService, setLeaderboardService] = useState(null);

    const [showBadges, setShowBadges] = useState(false);
    const [badges, setBadges] = useState([]);
    const [progress, setProgress] = useState(null);


    const [pointsService, setPointsService] = useState(null);

    // Get lesson ID from URL parameters
    const urlParams = new URLSearchParams(location.search);
    const lessonIdFromUrl = urlParams.get('lesson');

    // Try multiple sources for lesson ID
    const currentLessonId = lessonIdFromUrl ||
        context.currentLesson ||
        context.alreadyLinkedLesson;

    const lesson = currentLessonId ? findLessonById(currentLessonId) : null;

    // Find course - try multiple approaches
    let course = null;
    if (lesson) {
        course = findCourseByLessonId(currentLessonId);
    } else if (context.user?.course_name) {
        // Fallback to context course info
        course = { courseName: context.user.course_name };
    }

    // Check if we're in standalone mode
    const isStandalone = !context.user?.resource_link_id;

    const isPrivileged = context.user?.privileged || false;

    // Initialize services
    useEffect(() => {
        if (context.userID) {
            const isLMSUser = PointsService.isLMSUser(context);

            // Initialize points service for badges
            const ptsService = new PointsService(
                context.firebase,
                context.browserStorage,
                context.userID,
                isLMSUser
            );
            setPointsService(ptsService);

            // Initialize the points service first, then load data
            const initializeData = async () => {
                try {
                    // Initialize user data in PointsService (this loads from Firebase)
                    await ptsService.initializeUserData();

                    // Now load badges and progress
                    await loadBadgesAndProgress(ptsService);
                } catch (error) {
                    console.error('Error initializing data:', error);
                }
            };

            initializeData();

            // Initialize leaderboard service for non-privileged users
            if (!isPrivileged) {
                const lbService = new LeaderboardService(
                    context.firebase,
                    context.browserStorage,
                    context.userID,
                    isLMSUser
                );
                setLeaderboardService(lbService);
            }

            // Load badges
            ptsService.getEarnedBadges().then(earnedBadges => {
                setBadges(earnedBadges);
            });
        }
    }, [context.userID, isPrivileged]);

    const loadBadgesAndProgress = async (ptsService) => {
        const earnedBadges = await ptsService.getEarnedBadges();
        setBadges(earnedBadges);

        // Get current progress
        const currentProgress = ptsService.getCurrentProgress();
        setProgress(currentProgress);
    };

    const goToMainMenu = () => {
        history.push("/");
    };

    const toggleLeaderboard = () => {
        setShowLeaderboard(prev => !prev);
    };

    const toggleBadges = () => {
        setShowBadges(prev => !prev);
    };

    // Helper functions for badge progress (similar to BadgeDisplay.js)
    const getBadgeProgress = (badgeId) => {
        if (!progress) return null;

        const badgeDefinitions = {
            'first_problem': {
                target: 1,
                current: progress.totalProblemsCompleted + progress.sessionProblemsCompleted
            },
            'lesson_master': {
                target: 5,
                current: progress.totalLessonsCompleted + progress.sessionLessonsCompleted
            },
            'problem_solver': {
                target: 50,
                current: progress.totalProblemsCompleted + progress.sessionProblemsCompleted
            }
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

    const isBadgeEarned = (badgeId) => {
        return badges.some(badge => badge.id === badgeId);
    };

    // Define all badges including unearned ones
    const allBadges = [
        {
            id: 'first_problem',
            name: 'First Step',
            description: 'Complete your first problem',
            icon: '🚀',
            target: 1
        },
        {
            id: 'lesson_master',
            name: 'Lesson Master',
            description: 'Complete 5 lessons',
            icon: '🎓',
            target: 5
        },
        {
            id: 'problem_solver',
            name: 'Problem Solver',
            description: 'Complete 50 problems',
            icon: '💡',
            target: 50
        }
    ];

    console.log("AssignmentFinished debug:", {
        lessonIdFromUrl,
        currentLessonId,
        lesson,
        course,
        contextUser: context.user,
        isPrivileged,
        showLeaderboardForStudents: !isPrivileged
    });

    return (
        <div style={{ backgroundColor: "#F6F6F6", paddingBottom: 20, minHeight: "100vh" }}>
            <AppBar position="static">
                <Toolbar>
                    <Grid container spacing={0} role={"navigation"}>
                        <Grid item xs={3} key={1}>
                            <BrandLogoNav noLink={true} />
                        </Grid>
                    </Grid>
                </Toolbar>
            </AppBar>

            <Grid
                container
                spacing={0}
                direction="column"
                alignItems="center"
                justifyContent="center"
            >
                <Box width="75%" maxWidth={1500} textAlign="center" mt={6}>
                    <h1>🎉 You've completed this lesson!</h1>

                    {course && (
                        <h2 style={{ color: "#555", marginBottom: "8px" }}>
                            {course.courseName}
                        </h2>
                    )}

                    {lesson ? (
                        <>
                            <h3 style={{ marginTop: "0px", marginBottom: "16px" }}>
                                {lesson.name}: {lesson.topics}
                            </h3>
                            <Divider style={{ margin: "20px 0" }} />
                        </>
                    ) : (
                        <p>Lesson information not available</p>
                    )}

                    <div>
                        <p>Great job! You've reached the mastery for this lesson.</p>

                        {!isStandalone && (
                            <p style={{ marginTop: '10px' }}>Your score has been submitted to your instructor.</p>
                        )}
                    </div>

                    {/* Badge and Leaderboard Buttons */}
                    {!isPrivileged && !isStandalone && (
                        <div style={{ margin: "20px 0", display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={toggleBadges}
                                size="large"
                                startIcon={<span>🏆</span>}
                                style={{
                                    marginBottom: "20px",
                                    fontWeight: 'bold'
                                }}
                            >
                                View My Badges ({badges.length})
                            </Button>

                            {leaderboardService && (
                                <Button
                                    variant="contained"
                                    color="secondary"
                                    onClick={toggleLeaderboard}
                                    size="large"
                                    startIcon={<span>📊</span>}
                                    style={{
                                        marginBottom: "20px",
                                        backgroundColor: "#ff6b35",
                                        fontWeight: 'bold'
                                    }}
                                >
                                    View Class Leaderboard
                                </Button>
                            )}
                        </div>
                    )}

                    {isStandalone && (
                        <>
                            <p>You can return to the main menu to select another lesson.</p>
                            <Spacer height={24} />
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={goToMainMenu}
                                size="large"
                            >
                                Back to Main Menu
                            </Button>
                        </>
                    )}

                    <Spacer height={48} />
                </Box>
            </Grid>

            {/* Badge Modal */}
            {showBadges && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 2000,
                }} onClick={toggleBadges}>
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            padding: '24px',
                            maxWidth: '90vw',
                            maxHeight: '80vh',
                            overflow: 'auto',
                            minWidth: '300px',
                            width: '600px'
                        }}
                    >
                        <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🏆 Your Badges & Progress
                        </h2>

                        {/* Progress Summary */}
                        {progress && (
                            <div style={{
                                marginBottom: '20px',
                                padding: '12px',
                                backgroundColor: '#e7f3ff',
                                borderRadius: '8px',
                                fontSize: '14px',
                                color: '#0066cc'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                    <span><strong>Total Problems:</strong> {progress.totalProblemsCompleted + progress.sessionProblemsCompleted}</span>
                                    <span><strong>Total Lessons:</strong> {progress.totalLessonsCompleted + progress.sessionLessonsCompleted}</span>
                                </div>
                            </div>
                        )}

                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                            gap: '16px',
                            marginTop: '16px'
                        }}>
                            {allBadges.map(badge => {
                                const isEarned = isBadgeEarned(badge.id);
                                const badgeProgress = getBadgeProgress(badge.id);
                                const inProgress = isBadgeInProgress(badge.id);
                                const progressPercentage = getBadgeProgressPercentage(badge.id);
                                const currentBadge = badges.find(b => b.id === badge.id);

                                return (
                                    <div key={badge.id} style={{
                                        padding: '16px',
                                        backgroundColor: isEarned ? '#f0f9ff' : '#f8f9fa',
                                        borderRadius: '12px',
                                        textAlign: 'center',
                                        border: isEarned ? '2px solid #4CAF50' : '2px solid #e9ecef',
                                        position: 'relative',
                                        opacity: isEarned ? 1 : (inProgress ? 1 : 0.6)
                                    }} title={badge.description}>
                                        <div style={{
                                            fontSize: '32px',
                                            marginBottom: '8px',
                                            filter: isEarned ? 'none' : (inProgress ? 'none' : 'grayscale(100%)')
                                        }}>
                                            {badge.icon}
                                        </div>
                                        <div style={{
                                            fontWeight: 'bold',
                                            fontSize: '12px',
                                            color: isEarned ? '#2e7d32' : '#495057'
                                        }}>
                                            {badge.name}
                                        </div>

                                        {isEarned ? (
                                            <div style={{
                                                fontSize: '10px',
                                                color: '#4CAF50',
                                                marginTop: '4px',
                                                fontWeight: 'bold'
                                            }}>
                                                ✓ Earned
                                            </div>
                                        ) : (
                                            <div style={{
                                                fontSize: '10px',
                                                color: inProgress ? '#ff9800' : '#6c757d',
                                                marginTop: '4px'
                                            }}>
                                                {badgeProgress ? `${badgeProgress.current}/${badge.target}` : `0/${badge.target}`}
                                            </div>
                                        )}

                                        {/* Progress bar for in-progress badges */}
                                        {inProgress && !isEarned && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '8px',
                                                left: '12px',
                                                right: '12px',
                                                height: '4px',
                                                backgroundColor: '#e9ecef',
                                                borderRadius: '2px',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    height: '100%',
                                                    backgroundColor: '#4CAF50',
                                                    width: `${progressPercentage}%`,
                                                    transition: 'width 0.3s ease'
                                                }} />
                                            </div>
                                        )}

                                        {/* Earned date for earned badges */}
                                        {isEarned && currentBadge && (
                                            <div style={{
                                                fontSize: '9px',
                                                color: '#666',
                                                marginTop: '2px'
                                            }}>
                                                {new Date(currentBadge.earnedAt).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Empty state */}
                        {badges.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                                <p>No badges earned yet. Complete lessons and problems to earn badges!</p>
                            </div>
                        )}

                        <div style={{ textAlign: 'center', marginTop: '20px' }}>
                            <Button
                                onClick={toggleBadges}
                                variant="contained"
                                color="primary"
                                style={{ minWidth: '120px' }}
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Leaderboard Modal */}
            {showLeaderboard && leaderboardService && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 2000,
                }} onClick={toggleLeaderboard}>
                    <div onClick={(e) => e.stopPropagation()}>
                        <Leaderboard
                            leaderboardService={leaderboardService}
                            currentUserId={context.userID}
                            onClose={toggleLeaderboard}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default withRouter(AssignmentFinished);
