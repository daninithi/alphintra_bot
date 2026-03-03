package com.alphintra.auth.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.alphintra.auth.model.SpecializationLevel;
import com.alphintra.auth.model.SupportTeam;
import com.alphintra.auth.model.TicketCategory;
import com.alphintra.auth.service.SupportTeamService;

@RestController
@RequestMapping("/admin/support")
public class SupportTeamController {

    @Autowired
    private SupportTeamService supportTeamService;

    @PostMapping("/create")
    public ResponseEntity<?> createSupportMember(@RequestBody Map<String, String> request) {
        try {
            String email = request.get("email");
            if (email == null || email.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(
                    Map.of("success", false, "message", "Email is required")
                );
            }

            Map<String, Object> result = supportTeamService.createSupportMember(email);
            SupportTeam member = (SupportTeam) result.get("member");
            String rawPassword = (String) result.get("rawPassword");
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Support member created successfully.");
            response.put("member", Map.of(
                "id", member.getId(),
                "username", member.getUsername(),
                "email", member.getEmail(),
                "active", member.getActive(),
                "createdAt", member.getCreatedAt()
            ));
            response.put("credentials", Map.of(
                "username", member.getUsername(),
                "password", rawPassword
            ));
            
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(
                Map.of("success", false, "message", e.getMessage())
            );
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", "Failed to create support member: " + e.getMessage())
            );
        }
    }

    @GetMapping("/all")
    public ResponseEntity<?> getAllMembers() {
        try {
            List<SupportTeam> members = supportTeamService.getAllMembers();
            return ResponseEntity.ok(Map.of("success", true, "members", members));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", "Failed to fetch members: " + e.getMessage())
            );
        }
    }

    @GetMapping("/active")
    public ResponseEntity<?> getActiveMembers() {
        try {
            List<SupportTeam> members = supportTeamService.getAllActiveMembers();
            return ResponseEntity.ok(Map.of("success", true, "members", members));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", "Failed to fetch active members: " + e.getMessage())
            );
        }
    }

    @PutMapping("/deactivate/{id}")
    public ResponseEntity<?> deactivateMember(@PathVariable Long id) {
        try {
            supportTeamService.deactivateMember(id);
            return ResponseEntity.ok(
                Map.of("success", true, "message", "Support member deactivated successfully")
            );
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(
                Map.of("success", false, "message", e.getMessage())
            );
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", "Failed to deactivate member: " + e.getMessage())
            );
        }
    }

    @PutMapping("/activate/{id}")
    public ResponseEntity<?> activateMember(@PathVariable Long id) {
        try {
            supportTeamService.activateMember(id);
            return ResponseEntity.ok(
                Map.of("success", true, "message", "Support member activated successfully")
            );
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(
                Map.of("success", false, "message", e.getMessage())
            );
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", "Failed to activate member: " + e.getMessage())
            );
        }
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<?> deleteMember(@PathVariable Long id) {
        try {
            supportTeamService.deleteMember(id);
            return ResponseEntity.ok(
                Map.of("success", true, "message", "Support member deleted successfully")
            );
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(
                Map.of("success", false, "message", e.getMessage())
            );
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", "Failed to delete member: " + e.getMessage())
            );
        }
    }

    // Category Assignment Endpoint
    @PostMapping("/assign-category/{id}")
    public ResponseEntity<?> assignCategory(@PathVariable Long id, @RequestParam String category) {
        try {
            TicketCategory ticketCategory = TicketCategory.valueOf(category);
            supportTeamService.assignCategory(id, ticketCategory);
            return ResponseEntity.ok(
                Map.of("success", true, "message", "Category assigned successfully")
            );
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(
                Map.of("success", false, "message", e.getMessage())
            );
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", "Failed to assign category: " + e.getMessage())
            );
        }
    }

    @GetMapping("/by-category")
    public ResponseEntity<?> getMembersByCategory(@RequestParam String category) {
        try {
            TicketCategory ticketCategory = TicketCategory.valueOf(category);
            List<SupportTeam> members = supportTeamService.getMembersByCategory(ticketCategory);
            return ResponseEntity.ok(Map.of("success", true, "members", members));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", "Failed to fetch members: " + e.getMessage())
            );
        }
    }

    // Specialization Level Endpoint
    @PutMapping("/specialization/{id}")
    public ResponseEntity<?> updateSpecialization(@PathVariable Long id, @RequestParam String level) {
        try {
            SpecializationLevel specializationLevel = SpecializationLevel.valueOf(level);
            supportTeamService.updateSpecializationLevel(id, specializationLevel);
            return ResponseEntity.ok(
                Map.of("success", true, "message", "Specialization level updated successfully")
            );
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(
                Map.of("success", false, "message", e.getMessage())
            );
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", "Failed to update specialization: " + e.getMessage())
            );
        }
    }

    // Workload Management Endpoint
    @PutMapping("/max-tickets/{id}")
    public ResponseEntity<?> updateMaxTickets(@PathVariable Long id, @RequestParam Integer maxTickets) {
        try {
            supportTeamService.updateMaxTickets(id, maxTickets);
            return ResponseEntity.ok(
                Map.of("success", true, "message", "Max tickets updated successfully")
            );
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(
                Map.of("success", false, "message", e.getMessage())
            );
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", "Failed to update max tickets: " + e.getMessage())
            );
        }
    }

    // Auto-routing Endpoint
    @GetMapping("/find-assignee")
    public ResponseEntity<?> findBestAssignee(@RequestParam String category, @RequestParam(defaultValue = "false") boolean highPriority) {
        try {
            TicketCategory ticketCategory = TicketCategory.valueOf(category);
            java.util.Optional<SupportTeam> assignee = supportTeamService.findBestAssignee(ticketCategory, highPriority);
            
            if (assignee.isPresent()) {
                SupportTeam member = assignee.get();
                return ResponseEntity.ok(Map.of(
                    "success", true,
                    "assignee", Map.of(
                        "id", member.getId(),
                        "username", member.getUsername(),
                        "email", member.getEmail(),
                        "specializationLevel", member.getSpecializationLevel(),
                        "currentLoad", member.getCurrentTicketCount(),
                        "maxTickets", member.getMaxTickets()
                    )
                ));
            } else {
                return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "No available support member found for this category"
                ));
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", "Failed to find assignee: " + e.getMessage())
            );
        }
    }

    // Workload Counter Endpoints
    @PostMapping("/increment-load/{id}")
    public ResponseEntity<?> incrementTicketCount(@PathVariable Long id) {
        try {
            supportTeamService.incrementTicketCount(id);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", e.getMessage())
            );
        }
    }

    @PostMapping("/decrement-load/{id}")
    public ResponseEntity<?> decrementTicketCount(@PathVariable Long id) {
        try {
            supportTeamService.decrementTicketCount(id);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(
                Map.of("success", false, "message", e.getMessage())
            );
        }
    }
}
