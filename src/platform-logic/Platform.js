import React from "react";
import { AppBar, Toolbar, Button } from "@material-ui/core";
import Grid from "@material-ui/core/Grid";
import ProblemWrapper from "@components/problem-layout/ProblemWrapper.js";
import LessonSelectionWrapper from "@components/problem-layout/LessonSelectionWrapper.js";
import { withRouter } from "react-router-dom";

import {
    coursePlans,
    findLessonById,
    LESSON_PROGRESS_STORAGE_KEY,
    MIDDLEWARE_URL,
    SITE_NAME,
    ThemeContext,
    MASTERY_THRESHOLD,
    USER_ID_STORAGE_KEY
} from "../config/config.js";
import to from "await-to-js";
import { toast } from "react-toastify";
import ToastID from "../util/toastIds";
import BrandLogoNav from "@components/BrandLogoNav";
import { cleanArray } from "../util/cleanObject";
import ErrorBoundary from "@components/ErrorBoundary";
import { CONTENT_SOURCE } from "@common/global-config";
import withTranslation from '../util/withTranslation';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import ProgressBar from "@components/ProgressBar";
import { PointsService } from "../services/PointsService"
import { LeaderboardService } from "../services/LeaderboardService"
import PointsDisplay from "@components/PointDisplay";
import Leaderboard from "@components/Leaderboard";

let problemPool = require(`@generated/processed-content-pool/${CONTENT_SOURCE}.json`);

let seed = Date.now().toString();
console.log("Generated seed");

class Platform extends React.Component {
    static contextType = ThemeContext;

    constructor(props, context) {
        super(props);

        this.activityContext = this.getActivityContext(context);
        this.lessonProgressKey = this.getLessonProgressKey();

        this.problemIndex = {
            problems: problemPool,
        };
        this.completedProbs = new Set();
        this.lesson = null;

        const { userID } = context;
        this.userID = userID;

        this.user = context.user || {};
        console.debug("USER: ", this.user)
        this.isPrivileged = !!this.user.privileged;
        this.context = context;

        // Add each Q Matrix skill model attribute to each step
        for (const problem of this.problemIndex.problems) {
            for (
                let stepIndex = 0;
                stepIndex < problem.steps.length;
                stepIndex++
            ) {
                const step = problem.steps[stepIndex];
                step.knowledgeComponents = cleanArray(
                    context.skillModel[step.id] || []
                );
            }
        }
        this.state = {
            currProblem: null,
            status: "courseSelection",
            seed: seed,
            sessionMastery: 0, // Track mastery in current session
            persistedMastery: 0, // Track last persisted mastery
            showLeaderboard: false,
        };

        this.selectLesson = this.selectLesson.bind(this);

        const isLMSUser = PointsService.isLMSUser(context);
        // Initialize points service
        this.pointsService = new PointsService(
            context.firebase,
            context.browserStorage,
            this.userID,
            isLMSUser
        );

        // Initialize user data
        this.pointsService.initializeUserData();

        this.leaderboardService = new LeaderboardService(
            context.firebase,
            context.browserStorage,
            this.state.userID,
            true,
            this.state.additionalContext
        )
    }

    // Add method to get activity context
    getActivityContext(context) {
        const user = context.user || {};
        return {
            resourceLinkId: user.resource_link_id || 'standalone',
            lessonId: this.props.lessonID,
            userId: this.userID
        };
    }

    // Add method to generate unique progress key
    getLessonProgressKey() {
        const { resourceLinkId, lessonId, userId } = this.activityContext;
        return `lesson_progress_${resourceLinkId}_${lessonId}_${userId}`;
    }

    componentDidMount() {
        this._isMounted = true;
        if (this.props.lessonID != null) {
            console.log("calling selectLesson from componentDidMount...")
            const lesson = findLessonById(this.props.lessonID)
            console.debug("lesson: ", lesson)
            this.selectLesson(lesson).then(
                (_) => {
                    console.debug(
                        "loaded lesson " + this.props.lessonID,
                        this.lesson
                    );
                }
            );

            const { setLanguage } = this.props;
            if (lesson.courseName === 'Matematik 4') {
                setLanguage('se')
            } else {
                const defaultLocale = localStorage.getItem('defaultLocale');
                setLanguage(defaultLocale)
            }
        } else if (this.props.courseNum != null) {
            this.selectCourse(coursePlans[parseInt(this.props.courseNum)]);
        }
        this.onComponentUpdate(null, null, null);
    }

    componentWillUnmount() {
        this._isMounted = false;
        this.context.problemID = "n/a";

        // If user leaves without completing, reset session points
        if (this.state.status === "learning" && this.pointsService) {
            const lostPoints = this.pointsService.resetSessionPoints();
            if (lostPoints > 0) {
                console.log(`User left without completing. Lost ${lostPoints} unpersisted points.`);
            }
        }

        // Note: Mastery changes are lost if user leaves without clicking Next Problem
        // This is intentional - same behavior as points
        if (this.state.status === "learning" && this.state.sessionMastery > this.state.persistedMastery) {
            console.log(`User left without saving mastery progress. Session mastery: ${this.state.sessionMastery}, Persisted: ${this.state.persistedMastery}`);
        }
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        this.onComponentUpdate(prevProps, prevState, snapshot);
    }


    onComponentUpdate(prevProps, prevState, snapshot) {
        if (
            Boolean(this.state.currProblem?.id) &&
            this.context.problemID !== this.state.currProblem.id
        ) {
            this.context.problemID = this.state.currProblem.id;
        }
        if (this.state.status !== "learning") {
            this.context.problemID = "n/a";
        }
    }

    async selectLesson(lesson, updateServer = true) {
        const context = this.context;
        console.debug("lesson: ", lesson)
        console.debug("update server: ", updateServer)
        console.debug("context: ", context)
        if (!this._isMounted) {
            console.debug("component not mounted, returning early (1)");
            return;
        }
        if (this.isPrivileged) {
            // from canvas or other LTI Consumers
            console.log("valid privilege")
            let err, response;
            [err, response] = await to(
                fetch(`${MIDDLEWARE_URL}/setLesson`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        token: context?.jwt || this.context?.jwt || "",
                        lesson,
                        courseName: context?.user.course_name || "",
                        courseId: context?.user.course_id || "",
                        courseCode: context?.user.course_code || "",
                        resourceLinkTitle: context?.user.resource_link_title || "", // ✅ Add this
                    }),
                })
            );
            if (err || !response) {
                toast.error(
                    `Error setting lesson for assignment "${this.user.resource_link_title}"`
                );
                console.debug(err, response);
                return;
            } else {
                if (response.status !== 200) {
                    switch (response.status) {
                        case 400:
                            const responseText = await response.text();
                            let [message, ...addInfo] = responseText.split("|");
                            if (
                                Array.isArray(addInfo) &&
                                addInfo[0].length > 1
                            ) {
                                addInfo = JSON.parse(addInfo[0]);
                            }
                            switch (message) {
                                case "resource_already_linked":
                                    toast.error(
                                        `${addInfo.from} has already been linked to lesson ${addInfo.to}. Please create a new assignment.`,
                                        {
                                            toastId:
                                                ToastID.set_lesson_duplicate_error.toString(),
                                        }
                                    );
                                    return;
                                default:
                                    toast.error(`Error: ${responseText}`, {
                                        toastId:
                                            ToastID.expired_session.toString(),
                                        closeOnClick: true,
                                    });
                                    return;
                            }
                        case 401:
                            toast.error(
                                `Your session has either expired or been invalidated, please reload the page to try again.`,
                                {
                                    toastId: ToastID.expired_session.toString(),
                                }
                            );
                            this.props.history.push("/session-expired");
                            return;
                        case 403:
                            toast.error(
                                `You are not authorized to make this action. (Are you an instructor?)`,
                                {
                                    toastId: ToastID.not_authorized.toString(),
                                }
                            );
                            return;
                        default:
                            toast.error(
                                `Error setting lesson for assignment "${this.user.resource_link_title}." If reloading does not work, please contact us.`,
                                {
                                    toastId:
                                        ToastID.set_lesson_unknown_error.toString(),
                                }
                            );
                            return;
                    }
                } else {
                    toast.success(
                        `Successfully linked assignment "${this.user.resource_link_title}" to lesson ${lesson.id} "${lesson.topics}"`,
                        {
                            toastId: ToastID.set_lesson_success.toString(),
                        }
                    );
                    const responseText = await response.text();
                    let [, ...addInfo] = responseText.split("|");
                    this.props.history.push(
                        `/assignment-already-linked?to=${addInfo.to}`
                    );
                }
            }
        }

        this.lesson = lesson;
        this.context.currentLesson = lesson.id; // 🧩 Add this line

        const loadLessonProgress = async () => {
            // firebase (cloud)
            const firebase = this.context.firebase;
            const userId = this.userID;
            const lessonId = this.lesson.id;
            const resourceLinkId = this.context.user?.resource_link_id;
            console.log("📚 LoadLessonProgress - Platform.js", {
                userId,
                lessonId,
                resourceLinkId
            });
            try {
                if (userId) {
                    const progressDocId = resourceLinkId ? `${lessonId}_${resourceLinkId}`
                        : lessonId;
                    const progressRef = doc(firebase.db, 'users', userId, 'lessons', progressDocId);
                    const docSnap = await getDoc(progressRef);
                    if (!this._isMounted) {
                        console.debug("component not mounted during progress load, returning early");
                        return null;
                    }
                    if (docSnap.exists()) {
                        const cloudProgress = docSnap.data();
                        console.debug("Restored lesson progress from cloud:", cloudProgress);

                        // Load completed problems
                        if (cloudProgress.completedProbs) {
                            this.completedProbs = new Set(cloudProgress.completedProbs);
                        }

                        // Load persisted mastery
                        if (cloudProgress.mastery) {
                            this.setState({
                                persistedMastery: cloudProgress.mastery,
                                sessionMastery: cloudProgress.mastery,
                                mastery: cloudProgress.mastery
                            });
                            console.log('📚 Loaded persisted mastery:', cloudProgress.mastery);
                        }

                        // IMPORTANT: Check if lesson was already completed based on persisted mastery
                        if (cloudProgress.mastery >= MASTERY_THRESHOLD) {
                            console.log("🎯 Lesson already completed based on persisted mastery - redirecting");
                            if (this.props.history && this._isMounted) {
                                this.props.history.push("/assignment-finished");
                                return null; // Stop further processing
                            }
                        }

                        return cloudProgress.completedProbs;
                    }
                }
            } catch (error) {
                console.error("Error loading lesson progress from cloud:", error);
            }

            // localforage (local)
            const { getByKey } = this.context.browserStorage;
            return await getByKey(
                LESSON_PROGRESS_STORAGE_KEY(this.lesson.id)
            ).catch((err) => { });
        };

        const [, prevCompletedProbs] = await Promise.all([
            this.props.loadBktProgress(),
            loadLessonProgress(),
        ]);
        if (!this._isMounted) {
            console.debug("component not mounted, returning early (2)");
            return;
        }
        if (prevCompletedProbs) {
            console.debug(
                "student has already made progress w/ problems in this lesson before",
                prevCompletedProbs
            );
            this.completedProbs = new Set(prevCompletedProbs);
        }

        // Handle students who already completed the lesson
        if (!this.isPrivileged && this.lesson && this.context.bktParams) {
            const objectives = Object.keys(this.lesson.learningObjectives);
            let score = objectives.reduce(
                (sum, skill) => sum + (this.context.bktParams[skill]?.probMastery || 0),
                0
            );
            score /= objectives.length;

            if (score >= MASTERY_THRESHOLD) {
                console.log("Lesson already completed — redirecting to finish page");
                if (this.props.history && this._isMounted) {
                    this.props.history.push("/assignment-finished");
                }
                return;
            }
        }

        if (this._isMounted) {
            this.setState(
                {
                    currProblem: this._nextProblem(
                        this.context ? this.context : context
                    ),
                },
                () => {
                    //console.log(this.state.currProblem);
                    //console.log(this.lesson);
                }
            );
        }
    }

    selectCourse = (course, context) => {
        this.course = course;
        this.setState({
            status: "lessonSelection",
        });
    };

    _nextProblem = (context) => {
        const objectives = Object.keys(this.lesson.learningObjectives);
        console.debug("Platform.js: objectives", objectives);
        let score = objectives.reduce((x, y) => {
            return x + context.bktParams[y].probMastery;
        }, 0);
        score /= objectives.length;
        if (score >= MASTERY_THRESHOLD) {
            this.displayMastery(score);
            return null;
        }

        seed = Date.now().toString();
        this.setState({ seed: seed });
        this.props.saveProgress();
        const problems = this.problemIndex.problems.filter(
            ({ courseName }) => !courseName.toString().startsWith("!!")
        );
        let chosenProblem;

        console.debug(
            "Platform.js: sample of available problems",
            problems.slice(0, 10)
        );

        for (const problem of problems) {
            // Calculate the mastery for this problem
            let probMastery = 1;
            let isRelevant = false;
            for (const step of problem.steps) {
                if (typeof step.knowledgeComponents === "undefined") {
                    continue;
                }
                for (const kc of step.knowledgeComponents) {
                    if (typeof context.bktParams[kc] === "undefined") {
                        console.log("BKT Parameter " + kc + " does not exist.");
                        continue;
                    }
                    if (kc in this.lesson.learningObjectives) {
                        isRelevant = true;
                    }
                    // Multiply all the mastery priors
                    if (!(kc in context.bktParams)) {
                        console.log("Missing BKT parameter: " + kc);
                    }
                    probMastery *= context.bktParams[kc].probMastery;
                }
            }
            if (isRelevant) {
                problem.probMastery = probMastery;
            } else {
                problem.probMastery = null;
            }
        }

        console.debug(
            `Platform.js: available problems ${problems.length}, completed problems ${this.completedProbs.size}`
        );
        chosenProblem = context.heuristic(problems, this.completedProbs);
        console.debug("Platform.js: chosen problem", chosenProblem);

        //console.log(Object.keys(context.bktParams).map((skill) => (context.bktParams[skill].probMastery <= this.lesson.learningObjectives[skill])));

        // There exists a skill that has not yet been mastered (a True)
        // Note (number <= null) returns false
        if (
            !Object.keys(context.bktParams).some(
                (skill) =>
                    context.bktParams[skill].probMastery <= MASTERY_THRESHOLD
            )
        ) {
            this.setState({ status: "graduated" });
            console.log("Graduated");
            return null;
        } else if (chosenProblem == null) {
            console.debug("no problems were chosen");
            // We have finished all the problems
            if (this.lesson && !this.lesson.allowRecycle) {
                // If we do not allow problem recycle then we have exhausted the pool
                this.setState({ status: "exhausted" });
                return null;
            } else {
                this.completedProbs = new Set();
                chosenProblem = context.heuristic(
                    problems,
                    this.completedProbs
                );
            }
        }

        if (chosenProblem) {
            this.setState({ currProblem: chosenProblem, status: "learning" });
            // console.log("Next problem: ", chosenProblem.id);
            console.debug("problem information", chosenProblem);
            this.context.firebase.startedProblem(
                chosenProblem.id,
                chosenProblem.courseName,
                chosenProblem.lesson,
                this.lesson.learningObjectives
            );
            return chosenProblem;
        } else {
            console.debug("still no chosen problem..? must be an error");
        }
    };

    problemComplete = async (context) => {
        this.completedProbs.add(this.state.currProblem.id);

        // // Persist accumulated points when moving to next problem
        // if (this.pointsService) {
        //     await this.pointsService.persistAccumulatedPoints();
        // }
        //
        // // Persist current mastery state when moving to next problem
        // if (this.state.sessionMastery > this.state.persistedMastery) {
        //     await this.persistMasteryState(this.state.sessionMastery);
        // }

        // Always persist when moving to next problem OR if mastery reached threshold
        const shouldPersist = this.state.sessionMastery > this.state.persistedMastery ||
            this.state.sessionMastery >= MASTERY_THRESHOLD;

        if (shouldPersist) {
            // Persist accumulated points
            if (this.pointsService) {
                await this.pointsService.persistAccumulatedPoints();
            }

            // Persist current mastery state
            if (this.state.sessionMastery > this.state.persistedMastery) {
                await this.persistMasteryState(this.state.sessionMastery);
            }
        }

        //firebase
        const firebase = this.context.firebase;
        const userId = this.userID;
        const lessonId = this.lesson.id;
        const resourceLinkId = this.context.user?.resource_link_id;
        console.debug(this.lesson);
        if (userId) {
            try {
                // Use resourceLinkId in the document path if available
                const progressDocId = resourceLinkId
                    ? `${lessonId}_${resourceLinkId}`
                    : lessonId;
                const progressRef = doc(firebase.db, 'users', userId, 'lessons', progressDocId);
                await setDoc(progressRef, {
                    completedProbs: Array.from(this.completedProbs),
                    courseName: this.context?.user.course_name || "",
                    courseId: this.context?.user.course_id || "",
                    courseCode: this.context?.user.course_code || "",
                    resourceLinkTitle: this.context?.user.resource_link_title || "", // ✅ Add this
                    resourceLinkId: resourceLinkId || "", // Store the resource link ID
                    activitySpecific: !!resourceLinkId // Mark as activity-specific
                }, { merge: true });
            } catch (error) {
                console.error("Error saving completed problem to Firebase:", error);
                this.context.firebase.submitSiteLog("site-error", `componentName: Platform.js`, {
                    errorName: error.name || "n/a",
                    errorCode: error.code || "n/a",
                    errorMsg: error.message || "n/a",
                    errorStack: error.stack || "n/a",
                }, this.state.currProblem.id);
            }
        }

        // localforage
        const { setByKey } = this.context.browserStorage;
        await setByKey(
            LESSON_PROGRESS_STORAGE_KEY(this.lesson.id),
            this.completedProbs
        ).catch((error) => {
            this.context.firebase.submitSiteLog(
                "site-error",
                `componentName: Platform.js`,
                {
                    errorName: error.name || "n/a",
                    errorCode: error.code || "n/a",
                    errorMsg: error.message || "n/a",
                    errorStack: error.stack || "n/a",
                },
                this.state.currProblem.id
            );
        });
        this._nextProblem(context);
    };

    displayMastery = async (mastery) => {
        this.setState({ sessionMastery: mastery, mastery: mastery });

        if (mastery >= MASTERY_THRESHOLD) {
            if (this.state.currProblem && this.state.status === "learning") {
                this.completedProbs.add(this.state.currProblem.id);

                // Final persistence of all data
                await this.finalizeLessonCompletion(mastery);
            } else {
                // If no current problem (already completed), just finalize
                await this.finalizeLessonCompletion(mastery);
            }
        }
    };

    // Add new method to handle lesson completion finalization
    finalizeLessonCompletion = async (mastery) => {
        console.log('🎯 Finalizing lesson completion...');

        // Award lesson completion points
        const pointsEarned = this.pointsService.awardPoints(true, {
            isLessonCompletion: true,
            masteryPercentage: Math.round(mastery * 100)
        });

        // Update leaderboard for lesson completion
        if (this.leaderboardService) {
            await this.leaderboardService.incrementLessonsCompleted();
        }

        // Final persistence of all points and progress
        await this.pointsService.persistAccumulatedPoints();
        await this.persistMasteryState(mastery);

        // Update Canvas with final score
        if (this.context.jwt) {
            await this.updateCanvasForCompletion(mastery);
        }

        this.setState({
            sessionMastery: mastery,
            persistedMastery: mastery
        });

        toast.success(`You've successfully completed this assignment! +${pointsEarned} points earned!`, {
            toastId: ToastID.successfully_completed_lesson.toString(),
            autoClose: 3000,
            closeOnClick: true,
            pauseOnHover: false,
        });

        // Redirect after a short delay to ensure everything is saved
        setTimeout(() => {
            if (this.props.history && this._isMounted) {
                this.props.history.push(`/assignment-finished?lesson=${this.lesson.id}`);
            }
        }, 2000);
    };

    // Add method to persist mastery state
    persistMasteryState = async (mastery) => {
        if (!this.userID || !this.context.firebase?.db) return;

        try {
            const firebase = this.context.firebase;
            const lessonId = this.lesson.id;
            const resourceLinkId = this.context.user?.resource_link_id;

            const progressDocId = resourceLinkId
                ? `${lessonId}_${resourceLinkId}`
                : lessonId;
            const progressRef = doc(firebase.db, 'users', this.userID, 'lessons', progressDocId);

            const isCompleted = mastery >= MASTERY_THRESHOLD;
            await setDoc(progressRef, {
                mastery: mastery,
                isCompleted: isCompleted, // Add this flag
                completedAt: isCompleted ? new Date().toISOString() : null, // Add completion timestamp
                lastMasteryUpdate: new Date().toISOString(),
                completedProbs: Array.from(this.completedProbs),
                courseName: this.context?.user.course_name || "",
                courseId: this.context?.user.course_id || "",
                courseCode: this.context?.user.course_code || "",
                resourceLinkTitle: this.context?.user.resource_link_title || "",
                resourceLinkId: resourceLinkId || "", // Store the resource link ID
                activitySpecific: !!resourceLinkId // Mark as activity-specific
            }, { merge: true });

            console.log('🎯 Mastery persisted to Firestore:', mastery);
            this.setState({ persistedMastery: mastery });
            // Update Canvas when mastery is persisted (only for significant updates)
            // You might want to add a threshold to avoid too many Canvas updates
            if (this.context.jwt && mastery >= MASTERY_THRESHOLD) {
                await this.updateCanvasForCompletion(mastery);
            }

        } catch (error) {
            console.error('Error persisting mastery:', error);
        }
    };

    // Add a method for Canvas updates on lesson completion
    updateCanvasForCompletion = async (mastery) => {
        console.debug("updateCanvasForCompletion() called", { mastery, jwt: this.context.jwt });

        if (!this.context.jwt) return;

        const relevantKc = {};
        if (this.lesson && this.lesson.learningObjectives) {
            Object.keys(this.lesson.learningObjectives).forEach((x) => {
                relevantKc[x] = this.context.bktParams[x]?.probMastery || 0;
            });
        }

        let err, response;
        [err, response] = await to(
            fetch(`${MIDDLEWARE_URL}/postScore`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    token: this.context?.jwt || "",
                    mastery,
                    components: relevantKc,
                }),
            })
        );

        if (err || !response) {
            console.error("Error updating Canvas:", err);
        } else if (response.status !== 200) {
            console.error("Canvas update failed with status:", response.status);
        } else {
            console.debug("Successfully updated Canvas with mastery:", mastery);
        }
    };

    // Add method to toggle leaderboard
    toggleLeaderboard = () => {
        this.setState(prevState => ({
            showLeaderboard: !prevState.showLeaderboard
        }));
    };

    render() {
        const { translate } = this.props;
        this.studentNameDisplay = this.context.studentName
            ? decodeURIComponent(this.context.studentName) + " | "
            : translate('platform.LoggedIn') + " | ";

        // Determine if leaderboard should be shown
        const shouldShowLeaderboard = this.isPrivileged
            ? (this.state.status === "courseSelection" || this.state.status === "lessonSelection")
            : false; // For non-privileged, we'll show it on assignment-finished page instead
        return (
            <div
                style={{
                    backgroundColor: "#F6F6F6",
                    paddingBottom: 20,
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                <AppBar position="sticky" style={{ top: 0, zIndex: 1000 }}>
                    <Toolbar>
                        <Grid
                            container
                            spacing={0}
                            role={"navigation"}
                            alignItems={"center"}
                        >
                            <Grid item xs={3} key={1}>
                                <BrandLogoNav
                                    isPrivileged={this.isPrivileged}
                                />
                            </Grid>
                            <Grid item xs={6} key={2}>
                                <div
                                    style={{
                                        textAlign: "center",
                                        alignItems: 'center',
                                        textAlignVertical: "center",
                                        paddingTop: "3px",
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        gap: '2px'
                                    }}
                                >
                                    {/* Lesson Title */}
                                    {Boolean(findLessonById(this.props.lessonID)) && (
                                        <div style={{ marginBottom: '4px' }}>
                                            {findLessonById(this.props.lessonID).name + " " + findLessonById(this.props.lessonID).topics}
                                        </div>
                                    )}

                                    {/* Points Display for non-privileged users */}
                                    {this.userID && !this.isPrivileged && (
                                        <PointsDisplay
                                            userId={this.userID}
                                            firebase={this.context.firebase}
                                            browserStorage={this.context.browserStorage}
                                            pointsService={this.pointsService}
                                            showLabel={true}
                                        />
                                    )}

                                    {/* Leaderboard Button - Centered and conditional */}
                                    {shouldShowLeaderboard && (
                                        <Button
                                            color="inherit"
                                            onClick={this.toggleLeaderboard}
                                            startIcon={<span>🏆</span>}
                                            style={{
                                                marginTop: '4px',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            Leaderboard
                                        </Button>
                                    )}
                                </div>
                            </Grid>
                            <Grid item xs={3} key={3}>
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-end',
                                        paddingTop: '3px',
                                    }}
                                >
                                    {this.state.status !== "courseSelection" &&
                                        this.state.status !== "lessonSelection" &&
                                        (this.lesson.showStuMastery == null || this.lesson.showStuMastery) && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                {this.studentNameDisplay}{translate('platform.Mastery')}
                                                <ProgressBar mastery={this.state.sessionMastery || 0} />
                                            </div>
                                        )}


                                </div>
                            </Grid>
                        </Grid>
                    </Toolbar>
                </AppBar>
                {this.state.status === "courseSelection" ? (
                    <LessonSelectionWrapper
                        selectLesson={this.selectLesson}
                        selectCourse={this.selectCourse}
                        history={this.props.history}
                        removeProgress={this.props.removeProgress}
                    />
                ) : (
                    ""
                )}
                {this.state.status === "lessonSelection" ? (
                    <LessonSelectionWrapper
                        selectLesson={this.selectLesson}
                        removeProgress={this.props.removeProgress}
                        history={this.props.history}
                        courseNum={this.props.courseNum}
                    />
                ) : (
                    ""
                )}
                {this.state.status === "learning" ? (
                    <ErrorBoundary
                        componentName={"Problem"}
                        descriptor={"problem"}
                    >
                        <ProblemWrapper
                            problem={this.state.currProblem}
                            problemComplete={this.problemComplete}
                            lesson={this.lesson}
                            seed={this.state.seed}
                            lessonID={this.props.lessonID}
                            displayMastery={this.displayMastery}
                            pointsService={this.pointsService} // ← Pass service directly
                            currentMastery={this.state.mastery || 0}
                            trackProblemAttempt={(problemId) =>
                                this.pointsService?.trackProblemAttempt(problemId) || 1
                            }
                        />
                    </ErrorBoundary>
                ) : (
                    ""
                )}
                {this.state.showLeaderboard && (
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
                    }} onClick={this.toggleLeaderboard}>
                        <div onClick={(e) => e.stopPropagation()}>
                            <Leaderboard
                                leaderboardService={this.leaderboardService}
                                currentUserId={this.userID}
                                onClose={this.toggleLeaderboard}
                                firebase={this.context.firebase}
                            />
                        </div>
                    </div>
                )}
                {this.state.status === "exhausted" ? (
                    <center>
                        <h2>
                            Thank you for learning with {SITE_NAME}. You have
                            finished all problems.
                        </h2>
                    </center>
                ) : (
                    ""
                )}
                {this.state.status === "graduated" ? (
                    <center>
                        <h2>
                            Thank you for learning with {SITE_NAME}. You have
                            mastered all the skills for this session!
                        </h2>
                    </center>
                ) : (
                    ""
                )}
            </div>
        );
    }
}

export default withRouter(withTranslation(Platform));
