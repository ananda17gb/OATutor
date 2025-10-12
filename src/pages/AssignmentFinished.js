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

    // Initialize leaderboard service for non-privileged users
    useEffect(() => {
        if (!isPrivileged && context.userID) {
            const isLMSUser = PointsService.isLMSUser(context);
            const service = new LeaderboardService(
                context.firebase,
                context.browserStorage,
                context.userID,
                isLMSUser
            );
            setLeaderboardService(service);
        }
    }, [isPrivileged, context]);

    const goToMainMenu = () => {
        history.push("/");
    };

    const toggleLeaderboard = () => {
        setShowLeaderboard(prev => !prev);
    };

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

                    {!isPrivileged && leaderboardService && (
                        <div style={{ margin: "20px 0" }}>
                            <p style={{ marginBottom: "16px" }}>
                                See how you rank against other students!
                            </p>
                            <Button
                                variant="contained"
                                color="secondary"
                                onClick={toggleLeaderboard}
                                size="large"
                                startIcon={<span>🏆</span>}
                                style={{
                                    marginBottom: "20px",
                                    backgroundColor: "#ff6b35",
                                    fontWeight: 'bold'
                                }}
                            >
                                View Class Leaderboard
                            </Button>
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
