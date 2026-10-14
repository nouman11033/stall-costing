import cv2
import numpy as np

img = cv2.imread("wall.png")
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

edges = cv2.Canny(gray,50,150)

contours,_ = cv2.findContours(edges,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)

i=0
for c in contours:
    x,y,w,h = cv2.boundingRect(c)
    if w>120 and h>120:
        crop = img[y:y+h,x:x+w]
        cv2.imwrite(f"piece_{i}.png",crop)
        i+=1import cv2
import numpy as np

img = cv2.imread("wall.png")
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

edges = cv2.Canny(gray,50,150)

contours,_ = cv2.findContours(edges,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)

i=0
for c in contours:
    x,y,w,h = cv2.boundingRect(c)
    if w>120 and h>120:
        crop = img[y:y+h,x:x+w]
        cv2.imwrite(f"piece_{i}.png",crop)
        i+=1