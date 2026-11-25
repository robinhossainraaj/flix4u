import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, logFirestoreError, OperationType } from '@/src/lib/firebase';
import type { ProfileFrameId } from '@/src/types/frames';

export interface CommunityComment {
  id: string;
  postId: string;
  authorUid: string;
  authorName: string;
  authorAvatar: string;
  authorFrame?: ProfileFrameId;
  content: string;
  createdAt: number;
}

export interface CommunityPost {
  id: string;
  authorUid: string;
  authorName: string;
  authorAvatar: string;
  authorFrame?: ProfileFrameId;
  content: string;
  imageUrl?: string;
  likesCount: number;
  likedBy: string[];
  commentsCount: number;
  reported: boolean;
  reportsCount: number;
  createdAt: number;
  updatedAt: number;
}

export async function createCommunityPost(
  uid: string,
  name: string,
  avatar: string,
  frame: ProfileFrameId | undefined,
  content: string,
  imageUrl?: string
): Promise<string | null> {
  if (!db) return null;
  try {
    const postRef = await addDoc(collection(db, 'community_posts'), {
      authorUid: uid,
      authorName: name.slice(0, 80),
      authorAvatar: (avatar || '').slice(0, 500),
      authorFrame: frame || 'none',
      content: content.slice(0, 2000),
      imageUrl: imageUrl ? imageUrl.slice(0, 500) : '',
      likesCount: 0,
      likedBy: [],
      commentsCount: 0,
      reported: false,
      reportsCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return postRef.id;
  } catch (err) {
    logFirestoreError(err, OperationType.CREATE, 'community_posts');
    return null;
  }
}

export async function toggleLikePost(postId: string, uid: string): Promise<boolean> {
  if (!db) return false;
  const postRef = doc(db, 'community_posts', postId);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(postRef);
      if (!snap.exists()) throw new Error('Post not found');
      const data = snap.data();
      const likedBy = Array.isArray(data.likedBy) ? [...data.likedBy] : [];
      const index = likedBy.indexOf(uid);
      let likesCount = typeof data.likesCount === 'number' ? data.likesCount : 0;

      if (index >= 0) {
        likedBy.splice(index, 1);
        likesCount = Math.max(0, likesCount - 1);
      } else {
        likedBy.push(uid);
        likesCount += 1;
      }

      transaction.update(postRef, {
        likedBy,
        likesCount,
        updatedAt: serverTimestamp(),
      });
    });
    return true;
  } catch (err) {
    logFirestoreError(err, OperationType.UPDATE, `community_posts/${postId}`);
    return false;
  }
}

export async function reportCommunityPost(postId: string): Promise<boolean> {
  if (!db) return false;
  const postRef = doc(db, 'community_posts', postId);
  try {
    const snap = await getDoc(postRef);
    if (!snap.exists()) return false;
    const data = snap.data();
    const reportsCount = (typeof data.reportsCount === 'number' ? data.reportsCount : 0) + 1;
    await updateDoc(postRef, {
      reported: true,
      reportsCount,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch (err) {
    logFirestoreError(err, OperationType.UPDATE, `community_posts/${postId}`);
    return false;
  }
}

export async function deleteCommunityPost(postId: string): Promise<boolean> {
  if (!db) return false;
  try {
    await deleteDoc(doc(db, 'community_posts', postId));
    return true;
  } catch (err) {
    logFirestoreError(err, OperationType.DELETE, `community_posts/${postId}`);
    return false;
  }
}

export async function addCommunityComment(
  postId: string,
  uid: string,
  name: string,
  avatar: string,
  frame: ProfileFrameId | undefined,
  content: string
): Promise<string | null> {
  if (!db) return null;
  const postRef = doc(db, 'community_posts', postId);
  try {
    const commentRef = await addDoc(collection(db, 'community_posts', postId, 'comments'), {
      postId,
      authorUid: uid,
      authorName: name.slice(0, 80),
      authorAvatar: (avatar || '').slice(0, 500),
      authorFrame: frame || 'none',
      content: content.slice(0, 1000),
      createdAt: serverTimestamp(),
    });

    const snap = await getDoc(postRef);
    if (snap.exists()) {
      const commentsCount = (typeof snap.data().commentsCount === 'number' ? snap.data().commentsCount : 0) + 1;
      await updateDoc(postRef, { commentsCount, updatedAt: serverTimestamp() });
    }

    return commentRef.id;
  } catch (err) {
    logFirestoreError(err, OperationType.CREATE, `community_posts/${postId}/comments`);
    return null;
  }
}

export async function deleteCommunityComment(postId: string, commentId: string): Promise<boolean> {
  if (!db) return false;
  const postRef = doc(db, 'community_posts', postId);
  try {
    await deleteDoc(doc(db, 'community_posts', postId, 'comments', commentId));
    const snap = await getDoc(postRef);
    if (snap.exists()) {
      const commentsCount = Math.max(0, (typeof snap.data().commentsCount === 'number' ? snap.data().commentsCount : 1) - 1);
      await updateDoc(postRef, { commentsCount, updatedAt: serverTimestamp() });
    }
    return true;
  } catch (err) {
    logFirestoreError(err, OperationType.DELETE, `community_posts/${postId}/comments/${commentId}`);
    return false;
  }
}
