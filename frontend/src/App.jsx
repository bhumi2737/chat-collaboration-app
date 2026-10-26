import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useChat } from './context/ChatContext';
import { AuthScreen } from './components/auth/AuthScreen';
import { NavSidebar } from './components/layout/NavSidebar';
import { Sidebar } from './components/sidebar/Sidebar';
import { ChatArea } from './components/chat/ChatArea';
import { NewChatModal } from './components/modals/NewChatModal';
import { NewGroupModal } from './components/modals/NewGroupModal';
import { GroupDetailsModal } from './components/modals/GroupDetailsModal';

export const App = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { activeConversation, activeConversationId, selectConversation } = useChat();

  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showGroupDetails, setShowGroupDetails] = useState(false);

  // Close group details if switched to a direct conversation
  const isGroupActive = activeConversation?.type === 'group';

  if (isLoading) {
    return (
      <div className="app-loading-screen">
        <div className="loading-card">
          <div className="brand-monogram pulse">CC</div>
          <h3>Connecting CollabChat...</h3>
          <span className="spinner-sm"></span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="app-layout">
      {/* Column 1: Navigation Sidebar (Midnight Navy #1D2B43) */}
      <NavSidebar
        onOpenNewChat={() => setShowNewChat(true)}
        onOpenNewGroup={() => setShowNewGroup(true)}
      />

      {/* Main Workspace: Column 2 (Chat List) & Column 3 (Main Conversation) & Optional Column 4 (Group Details) */}
      <div
        className={`chat-workspace ${activeConversationId ? 'chat-open' : 'sidebar-open'} ${
          showGroupDetails && isGroupActive ? 'details-open' : ''
        }`}
      >
        <Sidebar
          onOpenNewChat={() => setShowNewChat(true)}
          onOpenNewGroup={() => setShowNewGroup(true)}
        />

        <ChatArea
          isGroupDetailsOpen={showGroupDetails && isGroupActive}
          onOpenGroupDetails={() => setShowGroupDetails(!showGroupDetails)}
          onBackToSidebar={() => {
            selectConversation(null);
            setShowGroupDetails(false);
          }}
        />

        {showGroupDetails && isGroupActive && (
          <GroupDetailsModal onClose={() => setShowGroupDetails(false)} />
        )}
      </div>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
      {showNewGroup && <NewGroupModal onClose={() => setShowNewGroup(false)} />}
    </div>
  );
};

export default App;
