import React, { useContext } from "react";
import { findLessonById, _lessonPlansNoEditor, ThemeContext } from "../config/config";
import { AppBar, Box, Toolbar, Button } from "@material-ui/core";
import Grid from "@material-ui/core/Grid";
import Divider from "@material-ui/core/Divider";
import BrandLogoNav from "@components/BrandLogoNav";
import Spacer from "@components/Spacer";

const AssignmentFinished = () => {
    // const { history } = props;
    const lessonPlans = _lessonPlansNoEditor;
    const context = useContext(ThemeContext);

    // Assuming you have current lesson ID stored somewhere
    const currentLessonId = context.currentLesson || context.alreadyLinkedLesson;
    const lesson =
        typeof currentLessonId === "string" || typeof currentLessonId === "number"
            ? findLessonById(currentLessonId)
            : null;

    // const goToMainMenu = () => {
    //     history.push("/"); // or `/courses` depending on your route setup
    // };

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
                    <h1>🎉 You’ve completed this lesson!</h1>
                    {lesson && (
                        <>
                            <h2>{lesson.name}</h2>
                            <h3>{lesson.topics}</h3>
                            <Divider style={{ margin: "20px 0" }} />
                        </>
                    )}
                    <p>Great job! You’ve reached 100% mastery for this lesson.</p>
                    {/* <p>You can return to your course or review the problems again if you wish.</p> */}

                    {/* <Spacer height={24} /> */}
                    {/* <Button */}
                    {/*     variant="contained" */}
                    {/*     color="primary" */}
                    {/*     onClick={goToMainMenu} */}
                    {/* > */}
                    {/*     Back to Course */}
                    {/* </Button> */}
                    <Spacer height={48} />
                </Box>
            </Grid>
        </div>
    );
};

export default AssignmentFinished;
