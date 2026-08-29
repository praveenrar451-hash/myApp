// --- 1. SUPABASE INITIALIZATION ---
const SUPABASE_URL = 'https://mgrvkfcpuxubhzmylewv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7BjPkCUaH1EgtAdNWs7gSA_7dBN-98n';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let activeChatUser = null;
let realtimeChannel = null;

// --- 2. NAVIGATION & ROUTING LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    checkUserSession();

    // Bottom Navigation Switching
    const navIcons = document.querySelectorAll('.bottom-nav i, .nav-profile-pic');
    navIcons.forEach(icon => {
        icon.addEventListener('click', (e) => {
            const targetId = icon.getAttribute('data-target');
            if (!targetId) return;

            document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
            document.querySelectorAll('.bottom-nav i').forEach(i => i.classList.remove('active'));

            document.getElementById(targetId).classList.add('active');
            if(icon.tagName === 'I') icon.classList.add('active');

            if(targetId === 'view-profile') loadMyProfileData();
            if(targetId === 'view-search') loadAllJoinedUsers();
            if(targetId === 'view-home') loadHomeFeed();
        });
    });

    // Sub-page Open / Close Handlers
    document.getElementById('btn-edit-profile-open').addEventListener('click', () => {
        document.getElementById('subpage-edit-profile').classList.add('active');
    });
    document.getElementById('btn-close-edit').addEventListener('click', () => {
        document.getElementById('subpage-edit-profile').classList.remove('active');
    });

    // Chat Open from Top Right Header
    document.getElementById('btn-open-chats').addEventListener('click', () => {
        document.getElementById('subpage-chats').classList.add('active');
        loadChatsList();
    });
    document.getElementById('btn-close-chats').addEventListener('click', () => {
        document.getElementById('subpage-chats').classList.remove('active');
    });

    // Chat Room Close
    document.getElementById('btn-close-chatroom').addEventListener('click', () => {
        document.getElementById('subpage-chat-room').classList.remove('active');
        if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
    });

    // Create Post / Gallery Modal Open (Opens Real Phone Gallery!)
    document.getElementById('btn-create').addEventListener('click', openPhoneGalleryForPost);
    document.getElementById('nav-btn-create-open').addEventListener('click', openPhoneGalleryForPost);
    document.getElementById('btn-close-create').addEventListener('click', () => {
        document.getElementById('subpage-create').classList.remove('active');
    });

    // Profile Username Arrow / Dropdown -> Opens Telegram-style Chat List
    document.getElementById('nav-title-toggle').addEventListener('click', () => {
        document.getElementById('subpage-chats').classList.add('active');
        loadChatsList();
    });

    // Profile Picture Change Trigger
    document.getElementById('edit-avatar-preview').addEventListener('click', () => {
        document.getElementById('avatar-file-picker').click();
    });

    // Handle Profile Picture File Selection
    document.getElementById('avatar-file-picker').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async function(uploadEvent) {
                const base64Image = uploadEvent.target.result;
                document.getElementById('edit-avatar-preview').src = base64Image;
                document.getElementById('user-profile-avatar').src = base64Image;
                document.getElementById('nav-user-avatar').src = base64Image;

                // Update in Supabase Database instantly
                await supabaseClient
                    .from('profiles')
                    .update({ avatar_url: base64Image })
                    .eq('id', currentUser.id);

                alert('Profile picture updated successfully!');
            };
            reader.readAsDataURL(file);
        }
    });
});

// --- 3. LOGIN LOGIC ---
const loginForm = document.getElementById('login-form');
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById('login-username').value.trim();
    const passwordInput = document.getElementById('login-password').value;

    if (!usernameInput || !passwordInput) {
        alert('Please enter both username and password.');
        return;
    }

    if (passwordInput !== '272009') {
        alert('Incorrect password! Please use 272009');
        return;
    }

    let { data: profileData } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('username', usernameInput)
        .single();

    if (!profileData) {
        const dummyId = 'user_' + Math.random().toString(36).substring(2, 9);
        const { data: newProf } = await supabaseClient
            .from('profiles')
            .insert([{ 
                id: dummyId, 
                username: usernameInput, 
                full_name: usernameInput, 
                avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' 
            }])
            .select()
            .single();

        currentUser = { id: newProf ? newProf.id : dummyId, email: `${usernameInput}@app.com` };
    } else {
        currentUser = { id: profileData.id, email: `${usernameInput}@app.com` };
    }

    localStorage.setItem('insta_current_user', JSON.stringify(currentUser));
    transitionToMainApp();
});

function checkUserSession() {
    const savedUser = localStorage.getItem('insta_current_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        transitionToMainApp();
    }
}

async function transitionToMainApp() {
    document.getElementById('login-page').classList.remove('active');
    document.getElementById('main-app').classList.add('active');
    await loadUserProfileData();
    loadHomeFeed();
}

// --- 4. PROFILE MANAGEMENT & EDITING ---
async function loadUserProfileData() {
    if (!currentUser) return;
    const { data } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

    if (data) {
        document.getElementById('profile-display-username').innerText = data.username;
        document.getElementById('nav-title-toggle').querySelector('span').innerText = data.username;
        if (data.avatar_url) {
            document.getElementById('user-profile-avatar').src = data.avatar_url;
            document.getElementById('nav-user-avatar').src = data.avatar_url;
            document.getElementById('edit-avatar-preview').src = data.avatar_url;
        }
        document.getElementById('edit-name').value = data.full_name || '';
        document.getElementById('edit-username').value = data.username || '';
        document.getElementById('edit-bio').value = data.bio || '';
    }

    const { count: postsCount } = await supabaseClient.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id);
    const { count: followersCount } = await supabaseClient.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', currentUser.id);
    const { count: followingCount } = await supabaseClient.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', currentUser.id);

    document.getElementById('stat-posts-count').innerText = postsCount || 0;
    document.getElementById('stat-followers-count').innerText = followersCount || 0;
    document.getElementById('stat-following-count').innerText = followingCount || 0;

    loadMyProfileGrid();
}

document.getElementById('btn-save-edit').addEventListener('click', async () => {
    const fullName = document.getElementById('edit-name').value;
    const username = document.getElementById('edit-username').value;
    const bio = document.getElementById('edit-bio').value;

    const { error } = await supabaseClient
        .from('profiles')
        .update({ full_name: fullName, username: username, bio: bio })
        .eq('id', currentUser.id);

    if (error) {
        alert('Update failed: ' + error.message);
    } else {
        alert('Profile updated successfully!');
        document.getElementById('subpage-edit-profile').classList.remove('active');
        loadUserProfileData();
    }
});

async function loadMyProfileGrid() {
    const { data } = await supabaseClient
        .from('posts')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    const gridContainer = document.getElementById('my-profile-grid');
    gridContainer.innerHTML = '';
    if (data && data.length > 0) {
        data.forEach(post => {
            const img = document.createElement('img');
            img.src = post.image_url;
            gridContainer.appendChild(img);
        });
    }
}

// --- 5. REAL PHONE GALLERY UPLOAD FOR POSTS ---
function openPhoneGalleryForPost() {
    document.getElementById('device-file-picker').click();
}

document.getElementById('device-file-picker').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = async function(uploadEvent) {
            const base64Image = uploadEvent.target.result;
            
            // Open Create view sub-page to show selected image & take caption
            document.getElementById('subpage-create').classList.add('active');
            document.getElementById('selected-media-preview').src = base64Image;
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('btn-proceed-upload').addEventListener('click', async () => {
    const mediaUrl = document.getElementById('selected-media-preview').src;
    const caption = prompt('Enter a caption for your post:') || '';

    const { error } = await supabaseClient
        .from('posts')
        .insert([{ user_id: currentUser.id, image_url: mediaUrl, caption: caption }]);

    if (error) {
        alert('Upload failed: ' + error.message);
    } else {
        alert('Post uploaded successfully!');
        document.getElementById('subpage-create').classList.remove('active');
        loadUserProfileData();
        loadHomeFeed();
    }
});

async function loadHomeFeed() {
    const { data } = await supabaseClient
        .from('posts')
        .select('*, profiles(username, avatar_url)')
        .order('created_at', { ascending: false });

    const feedContainer = document.getElementById('posts-feed-container');
    feedContainer.innerHTML = '';

    if (data && data.length > 0) {
        data.forEach(post => {
            const postItem = document.createElement('div');
            postItem.style.marginBottom = '20px';
            postItem.innerHTML = `
                <div style="display:flex; align-items:center; padding:10px; gap:10px;">
                    <img src="${post.profiles?.avatar_url || 'https://via.placeholder.com/30'}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;">
                    <span style="font-weight:600; font-size:14px;">${post.profiles?.username || 'user'}</span>
                </div>
                <img src="${post.image_url}" style="width:100%; max-height:450px; object-fit:cover;">
                <div style="padding:10px; font-size:14px;">
                    <strong>${post.profiles?.username || 'user'}</strong> ${post.caption}
                </div>
            `;
            feedContainer.appendChild(postItem);
        });
    }
}

// --- 6. SEARCH ALL JOINED USERS ---
async function loadAllJoinedUsers() {
    const { data } = await supabaseClient
        .from('profiles')
        .select('*')
        .neq('id', currentUser.id);

    renderSearchResults(data || []);
}

document.getElementById('search-users-input').addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    if (!query) {
        loadAllJoinedUsers();
        return;
    }

    const { data } = await supabaseClient
        .from('profiles')
        .select('*')
        .ilike('username', `%${query}%`)
        .neq('id', currentUser.id);

    renderSearchResults(data || []);
});

function renderSearchResults(users) {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';

    if (users.length === 0) {
        resultsContainer.innerHTML = `<div style="padding:15px; color:#8e8e8e; text-align:center;">No users found</div>`;
        return;
    }

    users.forEach(user => {
        const userRow = document.createElement('div');
        userRow.style.cssText = 'display:flex; align-items:center; padding:10px 16px; gap:12px; cursor:pointer; border-bottom:1px solid #1a1a1a;';
        userRow.innerHTML = `
            <img src="${user.avatar_url || 'https://via.placeholder.com/40'}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
            <div>
                <div style="font-weight:600; font-size:14px; color:#fff;">${user.username}</div>
                <div style="color:#8e8e8e; font-size:12px;">${user.full_name || ''}</div>
            </div>
        `;
        userRow.addEventListener('click', () => {
            openChatRoom(user);
        });
        resultsContainer.appendChild(userRow);
    });
}

// --- 7. TELEGRAM-STYLE CHATS & REAL-TIME MESSAGING ---
async function loadChatsList() {
    const { data: profiles } = await supabaseClient.from('profiles').select('*').neq('id', currentUser.id);
    const chatsListContainer = document.getElementById('chats-list-container');
    chatsListContainer.innerHTML = '';

    if (profiles && profiles.length > 0) {
        profiles.forEach(user => {
            const chatRow = document.createElement('div');
            chatRow.style.cssText = 'display:flex; align-items:center; padding:12px 16px; gap:15px; cursor:pointer; border-bottom:1px solid #18222d;';
            chatRow.innerHTML = `
                <img src="${user.avatar_url || 'https://via.placeholder.com/50'}" style="width:50px;height:50px;border-radius:50%;object-fit:cover;">
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span style="font-weight:600; color:#fff; font-size:15px;">${user.username}</span>
                        <span style="color:#8596a5; font-size:12px;">online</span>
                    </div>
                    <div style="color:#8596a5; font-size:13px;">Tap to chat...</div>
                </div>
            `;
            chatRow.addEventListener('click', () => openChatRoom(user));
            chatsListContainer.appendChild(chatRow);
        });
    }
}

function openChatRoom(user) {
    activeChatUser = user;
    document.getElementById('subpage-chats').classList.remove('active');
    document.getElementById('subpage-chat-room').classList.add('active');
    document.getElementById('chatroom-username').innerText = user.username;
    document.getElementById('chatroom-user-pic').src = user.avatar_url || 'https://via.placeholder.com/40';
    loadMessages(user.id);
    setupRealtimeMessages();
}

async function loadMessages(receiverId) {
    const { data } = await supabaseClient
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

    const container = document.getElementById('chat-messages-container');
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = `
            <div class="no-messages-box">
                <p>No messages here yet...</p>
                <span>Send a message or tap the greeting below.</span>
                <div class="dog-sticker" id="send-dog-greeting">🐶 Hi</div>
            </div>
        `;
        const dogEl = document.getElementById('send-dog-greeting');
        if(dogEl) {
            dogEl.addEventListener('click', () => {
                sendMessage('🐶 Hi sticker');
            });
        }
    } else {
        data.forEach(msg => {
            appendMessageBubble(msg);
        });
        container.scrollTop = container.scrollHeight;
    }
}

function appendMessageBubble(msg) {
    const container = document.getElementById('chat-messages-container');
    // Remove no-messages box if present
    const noMsgBox = container.querySelector('.no-messages-box');
    if (noMsgBox) noMsgBox.remove();

    const bubble = document.createElement('div');
    const isMe = msg.sender_id === currentUser.id;
    bubble.style.cssText = `margin:6px 0; padding:8px 12px; border-radius:8px; max-width:70%; word-break:break-word; font-size:14px; ${isMe ? 'background:#2b5278; color:#fff; margin-left:auto;' : 'background:#18222d; color:#fff;'}`;
    bubble.innerText = msg.message;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

// Real-time listener using Supabase Channel
function setupRealtimeMessages() {
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);

    realtimeChannel = supabaseClient.channel('realtime-messages')
        .on('postgres_changes', { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'messages' 
        }, (payload) => {
            const newMsg = payload.new;
            if (activeChatUser && (
                (newMsg.sender_id === currentUser.id && newMsg.receiver_id === activeChatUser.id) ||
                (newMsg.sender_id === activeChatUser.id && newMsg.receiver_id === currentUser.id)
            )) {
                // Prevent duplicate appending if we just sent it
                if (newMsg.sender_id !== currentUser.id) {
                    appendMessageBubble(newMsg);
                }
            }
        })
        .subscribe();
}

document.getElementById('btn-send-message').addEventListener('click', () => {
    const textInput = document.getElementById('message-input-text');
    if (textInput.value.trim() !== '') {
        sendMessage(textInput.value.trim());
        textInput.value = '';
    }
});

async function sendMessage(text) {
    if (!activeChatUser) return;
    const msgObj = { sender_id: currentUser.id, receiver_id: activeChatUser.id, message: text };
    
    // Append locally immediately for instant feedback
    appendMessageBubble(msgObj);

    const { error } = await supabaseClient
        .from('messages')
        .insert([msgObj]);

    if (error) {
        alert('Message send failed: ' + error.message);
    }
                           }
