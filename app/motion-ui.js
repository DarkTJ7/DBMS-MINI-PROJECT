'use client';
import {createContext,useContext,useEffect,useState} from 'react';
import {motion,MotionConfig,useReducedMotion,useIsPresent} from 'motion/react';
import {motionTokens as t,springs,motionCSS} from '../lib/motion-tokens.mjs';

const Preferences=createContext({mounted:false,animate:false});
export function MotionProvider({children}) {
 const reduced=useReducedMotion(),[mounted,setMounted]=useState(false),[lowEnd,setLowEnd]=useState(false);
 useEffect(()=>{setLowEnd(!!navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4);setMounted(true);},[]);
 return <MotionConfig reducedMotion="user"><Preferences.Provider value={{mounted,animate:mounted&&!reduced&&!lowEnd}}><div style={motionCSS}>{children}</div></Preferences.Provider></MotionConfig>;
}
export function useMotionPreferences(){return useContext(Preferences);}
export function AnimatedCard({index=0,children,...props}) {
 const {animate}=useMotionPreferences();
 return <motion.button {...props} initial={animate?{opacity:0,y:t.distance.sm}:false} animate={{opacity:1,y:0}} transition={{duration:t.duration.normal,ease:t.easing.smooth,delay:animate?Math.min(index,7)*t.stagger:0}} whileHover={animate?{y:-t.distance.xs,transition:{...springs.snappy,delay:0}}:undefined} whileTap={animate?{scale:t.scale.press,transition:{duration:t.duration.instant,delay:0}}:undefined}>{children}</motion.button>;
}
export function AnimatedChip({children,...props}) {
 const {animate}=useMotionPreferences();
 return <motion.span {...props} layout={animate?'position':false} initial={animate?{opacity:0,scale:t.scale.press}:false} animate={{opacity:1,scale:1}} exit={{opacity:0}} transition={{duration:t.duration.fast,ease:t.easing.smooth}}>{children}</motion.span>;
}
export function AnimatedResults({loading,children,...props}) {
 const {animate}=useMotionPreferences();
 return <motion.div {...props} initial={animate?{opacity:0,y:t.distance.xs}:false} animate={{opacity:loading?0.55:1,y:0}} exit={{opacity:0}} transition={{duration:t.duration.fast,ease:t.easing.smooth}}>{children}</motion.div>;
}
export function AnimatedBackdrop({children,...props}) {
 const present=useIsPresent();
 return <motion.div {...props} inert={!present} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:t.duration.fast}}>{children}</motion.div>;
}
export function AnimatedModal({children,...props}) {
 const {animate}=useMotionPreferences();
 return <motion.section {...props} initial={animate?{opacity:0,y:t.distance.md,scale:t.scale.press}:{opacity:0}} animate={{opacity:1,y:0,scale:1}} exit={animate?{opacity:0,y:t.distance.sm}:{opacity:0}} transition={animate?springs.gentle:{duration:t.duration.instant}}>{children}</motion.section>;
}
export function AnimatedNotice({children,...props}) {
 const {animate}=useMotionPreferences();
 return <motion.div {...props} initial={animate?{opacity:0,y:t.distance.sm}:{opacity:0}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:t.duration.fast,ease:t.easing.smooth}}>{children}</motion.div>;
}
