import React, { useEffect, useState } from 'react';
import { MessageSquare, Heart, Flag, Trash2, Send, Image as ImageIcon, Sparkles, Shield, AlertTriangle } from 'lucide-react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { AvatarWithFrame } from '@/src/components/AvatarWithFrame';
import type { ProfileFrameId } from '@/src/types/frames';
import {
  createCommunityPost,
  toggleLikePost,
  reportCommunityPost,
  deleteCommunityPost,
  addCommunityComment,
  deleteCommunityComment,
  type CommunityPost,
  type CommunityComment,
} from '@/src/services/communityService';

export const CommunityPage: React.FC = () => {
  const { user, isAdmin, preferences } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'latest' | 'popular' | 'reported'>('latest');

  const [newContent, setNewContent] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentsMap, setCommentsMap] = useState<Record<string, CommunityComment[]>>({});
  const [commentInput, setCommentInput] = useState('');

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'community_posts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: CommunityPost[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          list.push({
            id: docSnap.id,
            authorUid: d.authorUid || '',
            authorName: d.authorName || 'Anime Fan',
            authorAvatar: d.authorAvatar || '',
            authorFrame: (d.authorFrame as ProfileFrameId) || 'none',
            content: d.content || '',
            imageUrl: d.imageUrl || '',
            likesCount: typeof d.likesCount === 'number' ? d.likesCount : 0,
            likedBy: Array.isArray(d.likedBy) ? d.likedBy : [],
            commentsCount: typeof d.commentsCount === 'number' ? d.commentsCount : 0,
            reported: Boolean(d.reported),
            reportsCount: typeof d.reportsCount === 'number' ? d.reportsCount : 0,
            createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now(),
            updatedAt: d.updatedAt?.toMillis ? d.updatedAt.toMillis() : Date.now(),
          });
        });
        setPosts(list);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!db || !expandedPostId) return;
    const q = query(collection(db, 'community_posts', expandedPostId, 'comments'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: CommunityComment[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          postId: expandedPostId,
          authorUid: d.authorUid || '',
          authorName: d.authorName || 'Viewer',
          authorAvatar: d.authorAvatar || '',
          authorFrame: (d.authorFrame as ProfileFrameId) || 'none',
          content: d.content || '',
          createdAt: d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now(),
        });
      });
      setCommentsMap((prev) => ({ ...prev, [expandedPostId]: list }));
    });
    return () => unsub();
  }, [expandedPostId]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newContent.trim()) return;
    setSubmitting(true);
    await createCommunityPost(
      user.uid,
      preferences.displayName || user.displayName || 'Anime Fan',
      preferences.photoURL || user.photoURL || '',
      (preferences as unknown as { equippedFrame?: ProfileFrameId }).equippedFrame,
      newContent.trim(),
      newImageUrl.trim() || undefined
    );
    setNewContent('');
    setNewImageUrl('');
    setShowImageInput(false);
    setSubmitting(false);
  };

  const handleAddComment = async (postId: string) => {
    if (!user || !commentInput.trim()) return;
    await addCommunityComment(
      postId,
      user.uid,
      preferences.displayName || user.displayName || 'Viewer',
      preferences.photoURL || user.photoURL || '',
      (preferences as unknown as { equippedFrame?: ProfileFrameId }).equippedFrame,
      commentInput.trim()
    );
    setCommentInput('');
  };

  const filteredPosts = posts.filter((p) => {
    if (activeTab === 'popular') return p.likesCount >= 3 || p.commentsCount >= 2;
    if (activeTab === 'reported') return p.reported || p.reportsCount > 0;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
      <div className="bg-slate-900/80 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-purple-400 via-fuchsia-300 to-indigo-400 bg-clip-text text-transparent flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-purple-400" />
            Anime Community
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect with otakus worldwide, share favorite moments, and join live discussions.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 border border-purple-500/30 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('latest')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'latest' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            Latest Feed
          </button>
          <button
            onClick={() => setActiveTab('popular')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'popular' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            Trending 🔥
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('reported')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                activeTab === 'reported' ? 'bg-red-600 text-white shadow-lg' : 'text-red-400 hover:text-red-300'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Moderation
            </button>
          )}
        </div>
      </div>

      {user ? (
        <form onSubmit={handleCreatePost} className="bg-slate-900/80 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-start gap-4">
            <AvatarWithFrame
              src={preferences.photoURL || user.photoURL || ''}
              alt="Avatar"
              frameId={(preferences as unknown as { equippedFrame?: ProfileFrameId }).equippedFrame}
              size="md"
            />
            <div className="flex-1 space-y-3">
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Share your thoughts on recent anime episodes, recommendations, or art..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-2xl p-4 text-white text-sm placeholder-slate-500 outline-none resize-none transition-all"
              />

              {showImageInput && (
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="Paste Image URL (optional)"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl p-3 text-white text-xs placeholder-slate-500 outline-none transition-all"
                />
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setShowImageInput(!showImageInput)}
                  className="flex items-center gap-2 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors px-3 py-2 rounded-xl bg-purple-950/40 border border-purple-500/20"
                >
                  <ImageIcon className="w-4 h-4" />
                  {showImageInput ? 'Hide Image Link' : 'Attach Image'}
                </button>

                <button
                  type="submit"
                  disabled={submitting || !newContent.trim()}
                  className="py-2.5 px-6 rounded-xl font-bold text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/30 flex items-center gap-2 disabled:opacity-50 transition-all"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Posting...' : 'Publish Post'}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="bg-slate-900/80 border border-purple-500/20 rounded-3xl p-6 text-center space-y-3">
          <p className="text-sm text-slate-300">Sign in with Google or Email to create posts and join community discussions.</p>
        </div>
      )}

      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading community feed...</div>
        ) : filteredPosts.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
            <Sparkles className="w-10 h-10 text-purple-400 mx-auto opacity-50" />
            <h3 className="text-lg font-bold text-white">No community posts found</h3>
            <p className="text-sm text-slate-400">Be the first otaku to share something amazing with the community!</p>
          </div>
        ) : (
          filteredPosts.map((post) => {
            const isOwner = user?.uid === post.authorUid;
            const hasLiked = user ? post.likedBy.includes(user.uid) : false;
            const isExpanded = expandedPostId === post.id;
            const postComments = commentsMap[post.id] || [];

            return (
              <div
                key={post.id}
                className="bg-slate-900/80 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 shadow-xl space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AvatarWithFrame
                      src={post.authorAvatar}
                      alt={post.authorName}
                      frameId={post.authorFrame}
                      size="sm"
                    />
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        {post.authorName}
                        {post.authorUid === 'qylW0QA3XvZr3rBVZM8f6uHCELe2' && (
                          <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold rounded-full flex items-center gap-1">
                            <Shield className="w-3 h-3" /> Admin
                          </span>
                        )}
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {new Date(post.createdAt).toLocaleDateString()} at {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isOwner && user && (
                      <button
                        onClick={() => reportCommunityPost(post.id)}
                        title="Report Inappropriate"
                        className="p-2 text-slate-500 hover:text-amber-400 transition-colors"
                      >
                        <Flag className="w-4 h-4" />
                      </button>
                    )}
                    {(isOwner || isAdmin) && (
                      <button
                        onClick={() => deleteCommunityPost(post.id)}
                        title="Delete Post"
                        className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">{post.content}</p>

                {post.imageUrl && (
                  <div className="rounded-2xl overflow-hidden border border-slate-800 max-h-96 bg-slate-950">
                    <img src={post.imageUrl} alt="Post attachment" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="flex items-center gap-6 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
                  <button
                    onClick={() => user && toggleLikePost(post.id, user.uid)}
                    className={`flex items-center gap-2 py-1.5 px-3 rounded-xl transition-all ${
                      hasLiked
                        ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400 font-bold'
                        : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${hasLiked ? 'fill-rose-500 text-rose-500' : ''}`} />
                    <span>{post.likesCount} Likes</span>
                  </button>

                  <button
                    onClick={() => setExpandedPostId(isExpanded ? null : post.id)}
                    className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-slate-950/60 hover:bg-slate-800 text-slate-300 transition-all"
                  >
                    <MessageSquare className="w-4 h-4 text-purple-400" />
                    <span>{post.commentsCount} Comments</span>
                  </button>

                  {post.reported && isAdmin && (
                    <span className="ml-auto px-2.5 py-1 bg-red-500/20 border border-red-500/40 text-red-300 text-[10px] font-bold rounded-full">
                      Reported ({post.reportsCount})
                    </span>
                  )}
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-800 space-y-4 animate-fade-in">
                    <div className="space-y-3">
                      {postComments.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No comments yet. Be the first to reply!</p>
                      ) : (
                        postComments.map((comment) => {
                          const isCommentOwner = user?.uid === comment.authorUid;
                          return (
                            <div key={comment.id} className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3 flex items-start gap-3">
                              <AvatarWithFrame
                                src={comment.authorAvatar}
                                alt={comment.authorName}
                                frameId={comment.authorFrame}
                                size="sm"
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-white text-xs">{comment.authorName}</span>
                                  <span className="text-[10px] text-slate-500">{new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="text-slate-300 text-xs mt-1">{comment.content}</p>
                              </div>
                              {(isCommentOwner || isAdmin) && (
                                <button
                                  onClick={() => deleteCommunityComment(post.id, comment.id)}
                                  className="text-slate-600 hover:text-red-400 transition-colors p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {user && (
                      <div className="flex items-center gap-2 pt-2">
                        <input
                          type="text"
                          value={commentInput}
                          onChange={(e) => setCommentInput(e.target.value)}
                          placeholder="Write a supportive reply..."
                          className="flex-1 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none"
                        />
                        <button
                          onClick={() => handleAddComment(post.id)}
                          disabled={!commentInput.trim()}
                          className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                        >
                          Reply
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
