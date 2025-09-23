import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount } from 'wagmi'
import { MobileHeader } from '../ui/mobile-header'
import { Button } from '../ui/button'
import { DesktopSidebar } from '../navigation/DesktopSidebar'
import { MobileFooter } from '../navigation/MobileFooter'

export const EditProfilePage: React.FC = () => {
  const navigate = useNavigate()
  const { address } = useAccount()
  const [activeTab] = useState<'home' | 'discover' | 'following' | 'profile'>('profile')
  const [mobileTab] = useState<'home' | 'post' | 'profile'>('profile')
  
  // Form state
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [website, setWebsite] = useState('')
  const [twitter, setTwitter] = useState('')
  
  const handleSave = () => {
    // In production, this would save to ENS or your backend
    console.log('Saving profile:', { displayName, bio, website, twitter })
    navigate(`/profile/${address}`)
  }
  
  const handleCancel = () => {
    navigate(`/profile/${address}`)
  }
  
  return (
    <div className="h-screen bg-black flex">
      {/* Desktop Sidebar */}
      <DesktopSidebar 
        activeTab={activeTab}
        onTabChange={() => {}}
        onCreatePost={() => {}}
      />
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto md:ml-20 lg:ml-64">
        <div className="min-h-screen bg-black text-white pb-20 md:pb-0">
          {/* Mobile Header */}
          <MobileHeader 
            title="Edit Profile" 
            icon="close"
            onIconClick={handleCancel}
          />
          
          {/* Edit Form */}
          <div className="p-4 max-w-lg mx-auto">
            {/* Avatar Section */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-24 h-24 bg-neutral-800 rounded-full" />
                <button className="absolute bottom-0 right-0 bg-neutral-700 p-2 rounded-full hover:bg-neutral-600 cursor-pointer">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                />
              </div>
              
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself"
                  rows={3}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 resize-none"
                />
              </div>
              
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Website</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                />
              </div>
              
              <div>
                <label className="block text-sm text-neutral-400 mb-1">Twitter</label>
                <input
                  type="text"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="@username"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
                />
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-3 mt-8">
              <Button
                variant="outline"
                onClick={handleCancel}
                className="flex-1 bg-transparent border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Footer */}
      <MobileFooter
        activeTab={mobileTab}
        onTabChange={() => {}}
      />
    </div>
  )
}