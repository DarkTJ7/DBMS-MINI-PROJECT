export const motionTokens = {
 duration:{instant:0.08,fast:0.18,normal:0.32,slow:0.5},
 easing:{smooth:[0.22,1,0.36,1]},
 distance:{xs:4,sm:8,md:16},
 scale:{press:0.98},
 stagger:0.025,
};
export const springs = {
 snappy:{type:'spring',stiffness:300,damping:30},
 gentle:{type:'spring',stiffness:180,damping:24},
};
export const motionCSS = {
 '--motion-fast':`${motionTokens.duration.fast}s`,
 '--motion-normal':`${motionTokens.duration.normal}s`,
 '--motion-slow':`${motionTokens.duration.slow}s`,
 '--motion-ease':`cubic-bezier(${motionTokens.easing.smooth.join(',')})`,
};
