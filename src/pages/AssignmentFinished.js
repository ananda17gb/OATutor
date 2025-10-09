import React, { useContext } from "react";
import { findLessonById, _lessonPlansNoEditor, ThemeContext, findCourseByLessonId, _coursePlansNoEditor } from "../config/config";
import { AppBar, Box, Toolbar, Button } from "@material-ui/core";
import Grid from "@material-ui/core/Grid";
import Divider from "@material-ui/core/Divider";
import BrandLogoNav from "@components/BrandLogoNav";
import Spacer from "@components/Spacer";
import { withRouter } from "react-router-dom";

const AssignmentFinished = (props) => {
    const { history, location } = props;
    const context = useContext(ThemeContext);

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

    const goToMainMenu = () => {
        history.push("/");
    };

    console.log("AssignmentFinished debug:", {
        lessonIdFromUrl,
        currentLessonId,
        lesson,
        course,
        contextUser: context.user
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

                    <p>Great job! You've reached 100% mastery for this lesson.</p>

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

                    {!isStandalone && (
                        <p>Your score has been submitted to your instructor.</p>
                    )}

                    <Spacer height={48} />
                </Box>
            </Grid>
        </div>
    );
};

export default withRouter(AssignmentFinished);


// import React, { useContext } from "react";
// import { findLessonById, _lessonPlansNoEditor, ThemeContext, findCourseByLessonId } from "../config/config";
// import { AppBar, Box, Toolbar, Button } from "@material-ui/core";
// import Grid from "@material-ui/core/Grid";
// import Divider from "@material-ui/core/Divider";
// import BrandLogoNav from "@components/BrandLogoNav";
// import Spacer from "@components/Spacer";
//
// const AssignmentFinished = (props) => {
//     const { history } = props;
//     const lessonPlans = _lessonPlansNoEditor;
//     const context = useContext(ThemeContext);
//
//     // Assuming you have current lesson ID stored somewhere
//     const currentLessonId = context.currentLesson || context.alreadyLinkedLesson;
//     const lesson =
//         typeof currentLessonId === "string" || typeof currentLessonId === "number"
//             ? findLessonById(currentLessonId)
//             : null;
//     console.debug(course)
//
//     // Find the course that contains this lesson
//     const course = lesson ? findCourseByLessonId(currentLessonId) : null;
//     console.debug(course)
//
//     // Check if we're in standalone mode (no LTI context)
//     const isStandalone = !context.user?.resource_link_id;
//
//     const goToMainMenu = () => {
//         history.push("/"); // or `/courses` depending on your route setup
//     };
//
//     return (
//         <div style={{ backgroundColor: "#F6F6F6", paddingBottom: 20, minHeight: "100vh" }}>
//             <AppBar position="static">
//                 <Toolbar>
//                     <Grid container spacing={0} role={"navigation"}>
//                         <Grid item xs={3} key={1}>
//                             <BrandLogoNav noLink={true} />
//                         </Grid>
//                     </Grid>
//                 </Toolbar>
//             </AppBar>
//
//             <Grid
//                 container
//                 spacing={0}
//                 direction="column"
//                 alignItems="center"
//                 justifyContent="center"
//             >
//                 <Box width="75%" maxWidth={1500} textAlign="center" mt={6}>
//                     <h1>🎉 You’ve completed this lesson!</h1>
//                     {course && (
//                         <h2 style={{ color: "#555", marginBottom: "8px" }}>
//                             {course.courseName}
//                         </h2>
//                     )}
//                     {lesson && (
//                         <>
//                             <h2>{lesson.name}</h2>
//                             <h3>{lesson.topics}</h3>
//                             <Divider style={{ margin: "20px 0" }} />
//                         </>
//                     )}
//                     <p>Great job! You’ve reached 100% mastery for this lesson.</p>
//                     {/* <p>You can return to your course or review the problems again if you wish.</p> */}
//                     {isStandalone && (
//                         <>
//                             <p>You can return to the main menu to select another lesson.</p>
//                             <Spacer height={24} />
//                             <Button
//                                 variant="contained"
//                                 color="primary"
//                                 onClick={goToMainMenu}
//                                 size="large"
//                             >
//                                 Back to Main Menu
//                             </Button>
//                         </>
//                     )}
//
//                     {!isStandalone && (
//                         <p>Your score has been submitted to your instructor.</p>
//                     )}
//
//                     <Spacer height={48} />
//                 </Box>
//             </Grid>
//         </div>
//     );
// };
//
// export default AssignmentFinished;
