import React, { useContext } from "react";
import { SITE_NAME, SITE_VERSION, ThemeContext } from "../config/config";
import { useHistory, useLocation } from "react-router-dom";
import { makeStyles, Button } from "@material-ui/core";
import ArrowBackIcon from "@material-ui/icons/ArrowBack";

const useStyles = makeStyles({
    "siteNavLink": {
        textAlign: 'left',
        paddingTop: "3px",
        "&:hover": {
            cursor: "pointer"
        },
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    backButton: {
        marginRight: "8px",
        textTransform: "none",
    },
})

function BrandLogoNav({ isPrivileged = false, noLink = false }) {
    const context = useContext(ThemeContext)
    const history = useHistory()
    const location = useLocation();
    const classes = useStyles()
    const brandString = `${SITE_NAME} (v${SITE_VERSION})`

    const navigateLink = (evt) => {
        if (evt.type === "click" || evt.key === "Enter") {
            history.push("/")
        }
    }

    const goBack = () => {
        if (location.pathname.includes("lessonSelection")) {
            history.push("/courseSelection");
        } else {
            history.goBack();
        }
    }

    const hideBackButton =
        location.pathname.includes("courseSelection") ||
        location.pathname.includes("lessonSelection") ||
        location.pathname === "/";

    return <>
        {/* specified to not link or was launched from lms as student*/}
        <div style={{ display: "flex", alignItems: "center" }}>
            {isPrivileged && !hideBackButton && (
                <Button
                    color="inherit"
                    size="small"
                    onClick={goBack}
                    className={classes.backButton}
                    startIcon={<ArrowBackIcon />}
                >
                    Back
                </Button>

            )}
            {noLink || (context.jwt.length !== 0 && !isPrivileged)
                ? (<div style={{ textAlign: 'left', paddingTop: 6 }}>
                    {brandString}
                </div>)
                :
                (<div role={"link"} tabIndex={0} onClick={navigateLink} onKeyDown={navigateLink}
                    className={classes.siteNavLink}>
                    {brandString}
                </div>)
            }
        </div>
    </>
}

export default BrandLogoNav
