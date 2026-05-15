import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs, orderBy, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logout-btn');
  const userGreeting = document.getElementById('user-greeting');
  const userAvatar = document.getElementById('user-avatar');
  
  // Dashboard Tabs
  const tabs = document.querySelectorAll('.pill-tab');
  const sections = document.querySelectorAll('.dash-section');

  // Vault/Files Elements
  const emptyState = document.getElementById('vault-empty-state');
  const populatedState = document.getElementById('vault-populated-state');
  const mainUploadBtn = document.getElementById('main-upload-btn');
  const fileInput = document.getElementById('file-input');
  const fileList = document.getElementById('file-list');
  const uploadStatus = document.getElementById('upload-status');
  const breadcrumbsContainer = document.getElementById('file-breadcrumbs');
  const createFolderBtn = document.getElementById('create-folder-btn');
  const folderModal = document.getElementById('folder-modal');
  const folderForm = document.getElementById('folder-form');
  const folderSubmitBtn = document.getElementById('folder-submit-btn');

  // Notes Elements
  const notesEmptyState = document.getElementById('notes-empty-state');
  const notesPopulatedState = document.getElementById('notes-populated-state');
  const notesList = document.getElementById('notes-list');
  const noteModal = document.getElementById('note-modal');
  const noteForm = document.getElementById('note-form');
  const noteSubmitBtn = document.getElementById('note-submit-btn');

  // Team Elements
  const teamEmptyState = document.getElementById('team-empty-state');
  const teamPopulatedState = document.getElementById('team-populated-state');
  const teamList = document.getElementById('team-list');
  const teamModal = document.getElementById('team-modal');
  const teamForm = document.getElementById('team-form');
  const teamSubmitBtn = document.getElementById('team-submit-btn');

  let currentUser = null;
  let currentFolderId = 'root';
  let folderPath = [{ id: 'root', name: 'Root' }];

  // Check Auth State
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;
      
      const displayName = user.displayName || user.email.split('@')[0];
      let initials = 'TA';
      if (displayName) {
        initials = displayName.substring(0, 2).toUpperCase();
      } else if (user.email) {
        initials = user.email.substring(0, 2).toUpperCase();
      }
      if (userAvatar) userAvatar.textContent = initials;
      
      loadFiles();
      loadNotes();
      loadTeam();
    } else {
      window.location.href = '/';
    }
  });

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut(auth);
        window.location.href = '/';
      } catch (error) {
        console.error('Logout error:', error);
      }
    });
  }

  // --- Tab Switching Logic ---
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      sections.forEach(s => {
        s.classList.remove('active');
        s.style.display = 'none';
      });
      
      tab.classList.add('active');
      const targetId = tab.getAttribute('data-target');
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.classList.add('active');
        targetSection.style.display = 'block';
      }
    });
  });

  // --- File/Folder Logic ---
  const triggerFileInput = () => { fileInput.click(); };
  if (mainUploadBtn) mainUploadBtn.addEventListener('click', triggerFileInput);

  const showFolderModal = () => folderModal && folderModal.classList.add('show');
  const hideFolderModal = () => { if (folderModal) { folderModal.classList.remove('show'); folderForm.reset(); } };
  if (createFolderBtn) createFolderBtn.addEventListener('click', showFolderModal);
  document.getElementById('close-folder-modal')?.addEventListener('click', hideFolderModal);

  folderForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser || currentUser;
    if (!user) return;
    
    folderSubmitBtn.textContent = 'Creating...';
    folderSubmitBtn.disabled = true;

    try {
      await addDoc(collection(db, "notes"), {
        uid: user.uid,
        title: '[DIR]:' + document.getElementById('folder-name').value,
        content: 'parent:' + currentFolderId,
        createdAt: serverTimestamp()
      });
      hideFolderModal();
      loadFiles();
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Failed to create folder. ' + error.message);
    } finally {
      folderSubmitBtn.textContent = 'Create Folder';
      folderSubmitBtn.disabled = false;
    }
  });

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0]);
      }
    });
  }

  async function handleFileUpload(file) {
    const user = auth.currentUser || currentUser;
    if (!user) return;
    
    uploadStatus.style.display = 'block';
    uploadStatus.textContent = `Uploading ${file.name}...`;

    try {
      const storagePath = `users/${user.uid}/${currentFolderId}/${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, "files"), {
        uid: user.uid,
        name: file.name,
        url: downloadURL + '#p:' + currentFolderId,
        size: file.size,
        type: file.type,
        createdAt: serverTimestamp()
      });

      uploadStatus.textContent = 'Upload complete!';
      setTimeout(() => { uploadStatus.style.display = 'none'; }, 3000);
      loadFiles();
    } catch (error) {
      console.error('Upload failed:', error);
      uploadStatus.textContent = `Upload failed: ${error.message}`;
      uploadStatus.style.color = 'red';
    }
  }

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  async function loadFiles() {
    const user = auth.currentUser || currentUser;
    if (!user) return;
    try {
      const folderQ = query(collection(db, "notes"), where("uid", "==", user.uid));
      const folderSnapshot = await getDocs(folderQ);
      
      const fileQ = query(collection(db, "files"), where("uid", "==", user.uid));
      const fileSnapshot = await getDocs(fileQ);
      
      if (fileList) fileList.innerHTML = '';
      
      const allItems = [];

      folderSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.title && data.title.startsWith('[DIR]:')) {
          const name = data.title.replace('[DIR]:', '');
          const parentId = data.content && data.content.startsWith('parent:') ? data.content.split('parent:')[1] : 'root';
          if (parentId === currentFolderId) {
            allItems.push({ id: doc.id, name, type: 'folder', createdAt: data.createdAt });
          }
        }
      });

      fileSnapshot.forEach(doc => {
        const data = doc.data();
        const parentId = data.url && data.url.includes('#p:') ? data.url.split('#p:')[1] : 'root';
        if (parentId === currentFolderId) {
          allItems.push({ id: doc.id, ...data });
        }
      });

      if (allItems.length === 0) {
        if (emptyState) emptyState.style.display = 'flex';
        if (populatedState) populatedState.style.display = 'none';
        renderBreadcrumbs();
        return;
      }

      if (emptyState) emptyState.style.display = 'none';
      if (populatedState) populatedState.style.display = 'block';

      allItems.sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB - dateA;
      });

      allItems.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'file-item' + (item.type === 'folder' ? ' folder-item' : '');
        
        if (item.type === 'folder') {
          li.innerHTML = `
            <div class="file-info">
              <svg class="file-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/0000/svg">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" fill="currentColor" opacity="0.2" />
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span class="file-name">${item.name}</span>
            </div>
            <div class="col-type">Folder</div>
            <div class="col-size">--</div>
            <div class="col-action">
              <button class="btn btn-outline btn-sm">Open</button>
            </div>
          `;
          li.addEventListener('click', () => navigateToFolder(item.id, item.name));
        } else {
          const type = item.type ? item.type.split('/')[1]?.toUpperCase() || 'FILE' : 'FILE';
          const size = formatBytes(item.size || 0);
          const downloadUrl = item.url.split('#p:')[0];
          li.innerHTML = `
            <div class="file-info">
              <svg class="file-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/0000/svg">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <polyline points="13 2 13 9 20 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span class="file-name">${item.name}</span>
            </div>
            <div class="col-type">${type}</div>
            <div class="col-size">${size}</div>
            <div class="col-action">
              <a href="${downloadUrl}" target="_blank" class="btn btn-outline btn-sm" onclick="event.stopPropagation()">Download</a>
            </div>
          `;
        }
        if (fileList) fileList.appendChild(li);
      });

      renderBreadcrumbs();
    } catch (error) {
      console.error('Error loading files:', error);
    }
  }

  function navigateToFolder(id, name) {
    currentFolderId = id;
    folderPath.push({ id, name });
    loadFiles();
  }

  function renderBreadcrumbs() {
    if (!breadcrumbsContainer) return;
    breadcrumbsContainer.innerHTML = '';
    folderPath.forEach((folder, index) => {
      const isLast = index === folderPath.length - 1;
      const span = document.createElement('span');
      span.className = `breadcrumb-item ${isLast ? 'active' : ''}`;
      span.textContent = folder.name;
      if (!isLast) {
        span.addEventListener('click', () => {
          currentFolderId = folder.id;
          folderPath = folderPath.slice(0, index + 1);
          loadFiles();
        });
      }
      breadcrumbsContainer.appendChild(span);
    });
  }

  // --- Notes Logic ---
  const showNoteModal = () => noteModal && noteModal.classList.add('show');
  const hideNoteModal = () => { if (noteModal) { noteModal.classList.remove('show'); noteForm.reset(); } };

  document.getElementById('main-add-note-btn')?.addEventListener('click', showNoteModal);
  document.getElementById('close-note-modal')?.addEventListener('click', hideNoteModal);

  noteForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser || currentUser;
    if (!user) return;
    
    noteSubmitBtn.textContent = 'Saving...';
    noteSubmitBtn.disabled = true;

    try {
      await addDoc(collection(db, "notes"), {
        uid: user.uid,
        title: document.getElementById('note-title').value,
        content: document.getElementById('note-content').value,
        createdAt: serverTimestamp()
      });
      hideNoteModal();
      loadNotes();
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Failed to save note. ' + error.message);
    } finally {
      noteSubmitBtn.textContent = 'Save Note';
      noteSubmitBtn.disabled = false;
    }
  });

  async function loadNotes() {
    const user = auth.currentUser || currentUser;
    if (!user) return;
    try {
      // Removing orderBy to avoid index requirement
      const q = query(collection(db, "notes"), where("uid", "==", user.uid));
      const querySnapshot = await getDocs(q);
      
      if (notesList) notesList.innerHTML = '';
      
      const realNotes = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        if (!data.title || !data.title.startsWith('[DIR]:')) {
          realNotes.push({ id: doc.id, ...data });
        }
      });

      if (realNotes.length === 0) {
        if (notesEmptyState) notesEmptyState.style.display = 'flex';
        if (notesPopulatedState) notesPopulatedState.style.display = 'none';
        return;
      }

      if (notesEmptyState) notesEmptyState.style.display = 'none';
      if (notesPopulatedState) notesPopulatedState.style.display = 'block';

      // Sort in memory
      realNotes.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB - dateA;
      });

      realNotes.forEach((noteData) => {
        const date = noteData.createdAt ? noteData.createdAt.toDate().toLocaleDateString() : 'Just now';
        
        const div = document.createElement('div');
        div.className = 'note-card';
        div.innerHTML = `
          <div class="note-title" style="font-weight: 700; font-size: 1rem; margin-bottom: 0.5rem;">${noteData.title}</div>
          <div class="note-preview" style="color: var(--text-gray); font-size: 0.875rem; margin-bottom: 1rem;">${noteData.content}</div>
          <div class="note-meta" style="font-size: 0.75rem; color: var(--text-light);">
            <span>${date}</span>
          </div>
        `;
        if (notesList) notesList.appendChild(div);
      });
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  }

  // --- Team Logic ---
  const showTeamModal = () => teamModal && teamModal.classList.add('show');
  const hideTeamModal = () => { if (teamModal) { teamModal.classList.remove('show'); teamForm.reset(); } };

  document.getElementById('main-add-team-btn')?.addEventListener('click', showTeamModal);
  document.getElementById('close-team-modal')?.addEventListener('click', hideTeamModal);

  teamForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser || currentUser;
    if (!user) return;
    
    teamSubmitBtn.textContent = 'Sending...';
    teamSubmitBtn.disabled = true;

    try {
      await addDoc(collection(db, "teamMembers"), {
        uid: user.uid,
        name: document.getElementById('team-name').value,
        email: document.getElementById('team-email').value,
        role: document.getElementById('team-role').value,
        createdAt: serverTimestamp()
      });
      hideTeamModal();
      loadTeam();
    } catch (error) {
      console.error('Error adding team member:', error);
      alert('Failed to invite member. ' + error.message);
    } finally {
      teamSubmitBtn.textContent = 'Send Invitation';
      teamSubmitBtn.disabled = false;
    }
  });

  async function loadTeam() {
    const user = auth.currentUser || currentUser;
    if (!user) return;
    try {
      // Removing orderBy to avoid index requirement
      const q = query(collection(db, "teamMembers"), where("uid", "==", user.uid));
      const querySnapshot = await getDocs(q);
      
      if (teamList) teamList.innerHTML = '';
      
      const allMembers = [];
      querySnapshot.forEach(doc => {
        allMembers.push({ id: doc.id, ...doc.data() });
      });

      if (allMembers.length === 0) {
        if (teamEmptyState) teamEmptyState.style.display = 'flex';
        if (teamPopulatedState) teamPopulatedState.style.display = 'none';
        return;
      }

      if (teamEmptyState) teamEmptyState.style.display = 'none';
      if (teamPopulatedState) teamPopulatedState.style.display = 'block';

      // Sort in memory
      allMembers.sort((a, b) => {
        const dateA = a.createdAt?.toDate() || new Date(0);
        const dateB = b.createdAt?.toDate() || new Date(0);
        return dateB - dateA;
      });

      allMembers.forEach((teamData) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="team-member-name" style="font-weight: 500;">${teamData.name}</td>
          <td>${teamData.email}</td>
          <td><span class="role-badge" style="padding: 0.25rem 0.6rem; border-radius: 9999px; background: #f3f4f6; font-size: 0.75rem; font-weight: 500;">${teamData.role}</span></td>
        `;
        if (teamList) teamList.appendChild(tr);
      });
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  }

  window.addEventListener('click', (e) => {
    if (e.target === noteModal) hideNoteModal();
    if (e.target === teamModal) hideTeamModal();
    if (e.target === folderModal) hideFolderModal();
  });
});
