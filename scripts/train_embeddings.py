import json,sys
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.decomposition import TruncatedSVD
rows=json.load(sys.stdin)
tf=TfidfVectorizer(max_features=4000,stop_words='english')
x=tf.fit_transform([r['text'] for r in rows])
svd=TruncatedSVD(n_components=min(128,x.shape[0]-1,x.shape[1]-1),random_state=42)
v=svd.fit_transform(x)
v/=np.maximum(np.linalg.norm(v,axis=1,keepdims=True),1e-12)
v=np.pad(v,((0,0),(0,128-v.shape[1])))
json.dump({'model':{'vocabulary':{k:int(i) for k,i in tf.vocabulary_.items()},'idf':tf.idf_.tolist(),'components':svd.components_.tolist()},'vectors':v.tolist()},sys.stdout)
