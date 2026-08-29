// --- 1. SUPABASE INITIALIZATION ---
const SUPABASE_URL = 'https://mgrvkfcpuxubhzmylewv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7BjPkCUaH1EgtAdNWs7gSA_7dBN-98n';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

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
            if(targetId === 'view-search') loadExploreGrid();
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
    });

    // Create Post / Gallery Modal Open
    document.getElementById('btn-create').addEventListener('click', openCreateModal);
    document.getElementById('nav-btn-create-open').addEventListener('click', openCreateModal);
    document.getElementById('btn-close-create').addEventListener('click', () => {
        document.getElementById('subpage-create').classList.remove('active');
    });

    // Profile Username Arrow / Dropdown -> Opens Telegram-style Chat List
    document.getElementById('nav-title-toggle').addEventListener('click', () => {
        document.getElementById('subpage-chats').classList.add('active');
        loadChatsList();
    });
});

// --- 3. SEAMLESS USERNAME + PASSWORD LOGIN / AUTO-SIGNUP ---
const loginForm = document.getElementById('login-form');
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById('login-username').value.trim();
    const passwordInput = document.getElementById('login-password').value;

    if (!usernameInput || !passwordInput) {
        alert('Please enter both username and password.');
        return;
    }

    const email = `${usernameInput.toLowerCase().replace(/[^a-z0-9]/g, '')}@app.com`;

    // Try logging in first
    let { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: passwordInput });

    if (error) {
        // If user doesn't exist, automatically sign them up!
        const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({ email, password: passwordInput });
        
        if (signUpError) {
            alert('Login error: ' + signUpError.message);
            return;
        }

        if (signUpData.user) {
            currentUser = signUpData.user;
            // Create profile row
            await supabaseClient
                .from('profiles')
                .insert([{ 
                    id: currentUser.id, 
                    username: usernameInput, 
                    full_name: usernameInput, 
                    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' 
                }]);
            transitionToMainApp();
        }
    } else if (data.user) {
        currentUser = data.user;
        transitionToMainApp();
    }
});

async function checkUserSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        currentUser = session.user;
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

// --- 5. POSTS & GALLERY UPLOAD ---
function openCreateModal() {
    document.getElementById('subpage-create').classList.add('active');
    loadDeviceGalleryMock();
}

function loadDeviceGalleryMock() {
    const galleryGrid = document.getElementById('device-gallery-grid');
    galleryGrid.innerHTML = '';
    const sampleImages = [
        'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=500',
        'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=500',
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500'
    ];

    sampleImages.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.addEventListener('click', () => {
            document.getElementById('selected-media-preview').src = url;
        });
        galleryGrid.appendChild(img);
    });
    document.getElementById('selected-media-preview').src = sampleImages[0];
}

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
                    <img src="${post.profiles?.avatar_url || 'https://via.placeholder.com/30'}" style="width:30px;height:30px;border-radius:50%;">
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

// --- 6. SEARCH & EXPLORE ---
async function loadExploreGrid() {
    const { data } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false });
    const exploreContainer = document.getElementById('explore-grid-container');
    exploreContainer.innerHTML = '';
    if(data) {
        exploreContainer.style.display = 'grid';
        exploreContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        exploreContainer.style.gap = '2px';
        data.forEach(item => {
            const img = document.createElement('img');
            img.src = item.image_url;
            img.style.width = '100%';
            img.style.aspectRatio = '1/1';
            img.style.objectFit = 'cover';
            exploreContainer.appendChild(img);
        });
    }
}

document.getElementById('search-users-input').addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';

    if (!query) return;

    const { data } = await supabaseClient
        .from('profiles')
        .select('*')
        .ilike('username', `%${query}%`)
        .limit(10);

    if (data && data.length > 0) {
        data.forEach(user => {
            const userRow = document.createElement('div');
            userRow.style.cssText = 'display:flex; align-items:center; padding:10px 16px; gap:12px; cursor:pointer; border-bottom:1px solid #1a1a1a;';
            userRow.innerHTML = `
                <img src="${user.avatar_url || 'https://via.placeholder.com/40'}" style="width:40px;height:40px;border-radius:50%;">
                <div>
                    <div style="font-weight:600; font-size:14px;">${user.username}</div>
                    <div style="color:#8e8e8e; font-size:12px;">${user.full_name || ''}</div>
                </div>
            `;
            userRow.addEventListener('click', () => {
                alert(`Opening profile of ${user.username}`);
            });
            resultsContainer.appendChild(userRow);
        });
    }
});

// --- 7. TELEGRAM-STYLE CHATS & MESSAGING ---
async function loadChatsList() {
    const { data: profiles } = await supabaseClient.from('profiles').select('*').neq('id', currentUser.id);
    const chatsListContainer = document.getElementById('chats-list-container');
    chatsListContainer.innerHTML = '';

    if (profiles && profiles.length > 0) {
        profiles.forEach(user => {
            const chatRow = document.createElement('div');
            chatRow.style.cssText = 'display:flex; align-items:center; padding:12px 16px; gap:15px; cursor:pointer; border-bottom:1px solid #18222d;';
            chatRow.innerHTML = `
                <img src="${user.avatar_url || 'https://via.placeholder.com/50'}" style="width:50px;height:50px;border-radius:50%;">
                <div style="flex:1;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span style="font-weight:600; color:#fff; font-size:15px;">${user.username}</span>
                        <span style="color:#8596a5; font-size:12px;">recent</span>
                    </div>
                    <div style="color:#8596a5; font-size:13px;">Tap to open chat...</div>
                </div>
            `;
            chatRow.addEventListener('click', () => openChatRoom(user));
            chatsListContainer.appendChild(chatRow);
        });
    }
}

let activeChatUser = null;

function openChatRoom(user) {
    activeChatUser = user;
    document.getElementById('subpage-chat-room').classList.add('active');
    document.getElementById('chatroom-username').innerText = user.username;
    document.getElementById('chatroom-user-pic').src = user.avatar_url || 'https://via.placeholder.com/40';
    loadMessages(user.id);
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
        document.getElementById('send-dog-greeting').addEventListener('click', () => {
            sendMessage('🐶 Hi sticker');
        });
    } else {
        data.forEach(msg => {
            const bubble = document.createElement('div');
            const isMe = msg.sender_id === currentUser.id;
            bubble.style.cssText = `margin:6px 0; padding:8px 12px; border-radius:8px; max-width:70%; word-break:break-word; font-size:14px; ${isMe ? 'background:#2b5278; color:#fff; margin-left:auto;' : 'background:#18222d; color:#fff;'}`;
            bubble.innerText = msg.message;
            container.appendChild(bubble);
        });
        container.scrollTop = container.scrollHeight;
    }
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
    const { error } = await supabaseClient
        .from('messages')
        .insert([{ sender_id: currentUser.id, receiver_id: activeChatUser.id, message: text }]);

    if (!error) {
        loadMessages(activeChatUser.id);
    }
}
