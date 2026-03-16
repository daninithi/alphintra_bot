package com.alphintra.auth.service;

import java.security.SecureRandom;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.alphintra.auth.model.SpecializationLevel;
import com.alphintra.auth.model.SupportTeam;
import com.alphintra.auth.model.TicketCategory;
import com.alphintra.auth.repository.SupportTeamRepository;

@Service
public class SupportTeamService {

    @Autowired
    private SupportTeamRepository supportTeamRepository;

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private static final String CHAR_LOWER = "abcdefghijklmnopqrstuvwxyz";
    private static final String CHAR_UPPER = CHAR_LOWER.toUpperCase();
    private static final String NUMBER = "0123456789";
    private static final String SPECIAL_CHAR = "!@#$%";
    private static final String PASSWORD_CHARS = CHAR_LOWER + CHAR_UPPER + NUMBER + SPECIAL_CHAR;
    private static final SecureRandom random = new SecureRandom();

    @Transactional
    public Map<String, Object> createSupportMember(String email) {
        // Check if email already exists
        if (supportTeamRepository.existsByEmail(email)) {
            throw new RuntimeException("Support member with this email already exists");
        }

        // Generate username from email
        String username = generateUsername(email);
        
        // Ensure username is unique
        int counter = 1;
        String originalUsername = username;
        while (supportTeamRepository.existsByUsername(username)) {
            username = originalUsername + counter++;
        }

        // Generate random password
        String rawPassword = generatePassword(12);

        // Create support team member
        SupportTeam member = new SupportTeam();
        member.setEmail(email);
        member.setUsername(username);
        member.setPassword(passwordEncoder.encode(rawPassword));
        member.setActive(true);

        // Save to database
        SupportTeam savedMember = supportTeamRepository.save(member);

        // Return member with raw password for frontend to send via email
        Map<String, Object> result = new HashMap<>();
        result.put("member", savedMember);
        result.put("rawPassword", rawPassword);
        
        return result;
    }

    public Optional<SupportTeam> login(String username, String password) {
        Optional<SupportTeam> member = supportTeamRepository.findByUsername(username);
        if (member.isPresent() && member.get().getActive()) {
            if (passwordEncoder.matches(password, member.get().getPassword())) {
                return member;
            }
        }
        return Optional.empty();
    }

    public List<SupportTeam> getAllActiveMembers() {
        return supportTeamRepository.findByActiveTrue();
    }

    public List<SupportTeam> getAllMembers() {
        return supportTeamRepository.findAll();
    }

    public void deactivateMember(Long id) {
        SupportTeam member = supportTeamRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Support member not found"));
        member.setActive(false);
        supportTeamRepository.save(member);
    }

    public void activateMember(Long id) {
        SupportTeam member = supportTeamRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Support member not found"));
        member.setActive(true);
        supportTeamRepository.save(member);
    }

    public void deleteMember(Long id) {
        SupportTeam member = supportTeamRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Support member not found"));
        supportTeamRepository.delete(member);
    }

    // Category Assignment Methods
    @Transactional
    public void assignCategory(Long id, TicketCategory category) {
        SupportTeam member = supportTeamRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Support member not found"));
        
        // Check if another member already has this category with the same specialization level
        Optional<SupportTeam> existingMember = supportTeamRepository.findAll().stream()
            .filter(m -> m.getId() != id && 
                        m.getAssignedCategory() == category && 
                        m.getSpecializationLevel() == member.getSpecializationLevel())
            .findFirst();
        
        if (existingMember.isPresent()) {
            throw new RuntimeException("A " + member.getSpecializationLevel() + 
                " member is already assigned to " + category + 
                ". Please choose a different category or specialization level.");
        }
        
        member.setAssignedCategory(category);
        supportTeamRepository.save(member);
    }

    public List<SupportTeam> getMembersByCategory(TicketCategory category) {
        return supportTeamRepository.findAll().stream()
            .filter(member -> member.getActive() && member.getAssignedCategory() == category)
            .collect(Collectors.toList());
    }

    // Specialization Level Methods
    @Transactional
    public void updateSpecializationLevel(Long id, SpecializationLevel level) {
        SupportTeam member = supportTeamRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Support member not found"));
        
        // Check if changing level would conflict with existing member
        if (member.getAssignedCategory() != null) {
            Optional<SupportTeam> existingMember = supportTeamRepository.findAll().stream()
                .filter(m -> m.getId() != id && 
                            m.getAssignedCategory() == member.getAssignedCategory() && 
                            m.getSpecializationLevel() == level)
                .findFirst();
            
            if (existingMember.isPresent()) {
                throw new RuntimeException("A " + level + 
                    " member is already assigned to " + member.getAssignedCategory() + 
                    ". Cannot change specialization level.");
            }
        }
        
        member.setSpecializationLevel(level);
        supportTeamRepository.save(member);
    }

    // Workload Management Methods
    @Transactional
    public void updateMaxTickets(Long id, Integer maxTickets) {
        SupportTeam member = supportTeamRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Support member not found"));
        member.setMaxTickets(maxTickets);
        supportTeamRepository.save(member);
    }

    @Transactional
    public void incrementTicketCount(Long id) {
        SupportTeam member = supportTeamRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Support member not found"));
        member.setCurrentTicketCount(member.getCurrentTicketCount() + 1);
        supportTeamRepository.save(member);
    }

    @Transactional
    public void decrementTicketCount(Long id) {
        SupportTeam member = supportTeamRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Support member not found"));
        int newCount = Math.max(0, member.getCurrentTicketCount() - 1);
        member.setCurrentTicketCount(newCount);
        supportTeamRepository.save(member);
    }

    // Auto-Routing Method
    public Optional<SupportTeam> findBestAssignee(TicketCategory category, boolean isHighPriority) {
        List<SupportTeam> availableMembers = getMembersByCategory(category);

        if (availableMembers.isEmpty()) {
            return Optional.empty();
        }

        // Filter out overloaded members
        List<SupportTeam> underCapacityMembers = availableMembers.stream()
            .filter(member -> member.getCurrentTicketCount() < member.getMaxTickets())
            .collect(Collectors.toList());

        if (underCapacityMembers.isEmpty()) {
            // All members are at capacity — leave unassigned rather than overloading
            return Optional.empty();
        }

        // For high priority, prefer senior members
        if (isHighPriority) {
            Optional<SupportTeam> seniorMember = underCapacityMembers.stream()
                .filter(member -> member.getSpecializationLevel() == SpecializationLevel.SENIOR)
                .min(Comparator.comparingInt(SupportTeam::getCurrentTicketCount));
            
            if (seniorMember.isPresent()) {
                return seniorMember;
            }
        }

        // Return member with least current load
        return underCapacityMembers.stream()
            .min(Comparator.comparingInt(SupportTeam::getCurrentTicketCount));
    }

    private String generateUsername(String email) {
        // Extract the part before @ and clean it
        String baseName = email.split("@")[0];
        baseName = baseName.replaceAll("[^a-zA-Z0-9]", "");
        return "support_" + baseName.toLowerCase();
    }

    private String generatePassword(int length) {
        if (length < 8) {
            throw new IllegalArgumentException("Password length must be at least 8 characters");
        }

        StringBuilder password = new StringBuilder(length);

        // Ensure at least one character from each category
        password.append(CHAR_LOWER.charAt(random.nextInt(CHAR_LOWER.length())));
        password.append(CHAR_UPPER.charAt(random.nextInt(CHAR_UPPER.length())));
        password.append(NUMBER.charAt(random.nextInt(NUMBER.length())));
        password.append(SPECIAL_CHAR.charAt(random.nextInt(SPECIAL_CHAR.length())));

        // Fill the rest randomly
        for (int i = 4; i < length; i++) {
            password.append(PASSWORD_CHARS.charAt(random.nextInt(PASSWORD_CHARS.length())));
        }

        // Shuffle the password characters
        return shuffleString(password.toString());
    }

    private String shuffleString(String string) {
        char[] characters = string.toCharArray();
        for (int i = characters.length - 1; i > 0; i--) {
            int j = random.nextInt(i + 1);
            char temp = characters[i];
            characters[i] = characters[j];
            characters[j] = temp;
        }
        return new String(characters);
    }
}
